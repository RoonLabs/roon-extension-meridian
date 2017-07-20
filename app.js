"use strict";

var Meridian             = require("node-meridian-rs232"),
    RoonApi              = require("node-roon-api"),
    RoonApiSettings      = require('node-roon-api-settings'),
    RoonApiStatus        = require('node-roon-api-status'),
    RoonApiVolumeControl = require('node-roon-api-volume-control'),
    RoonApiSourceControl = require('node-roon-api-source-control');

var roon = new RoonApi({
    extension_id:        'com.roonlabs.meridian',
    display_name:        'Meridian Volume/Source Control',
    display_version:     "1.0.0",
    publisher:           'Roon Labs, LLC',
    email:               'contact@roonlabs.com',
    website:             'https://github.com/RoonLabs/roon-extension-meridian',
});

var mysettings = roon.load_config("settings") || {
    serialport:    "",
    source:        "AX",
    initialvolume: 45,
    mode:          "TN51",
};

var meridian = { rs232: new Meridian(mysettings.mode) };

function makelayout(settings) {
    var l = { 
        values:    settings,
	layout:    [],
	has_error: false
    };

    l.layout.push({
        type:      "string",
        title:     "Serial Port",
        maxlength: 256,
        setting:   "serialport",
    });

    l.layout.push({
        type:    "dropdown",
        title:   "RS232 Methods",
        values:  [
            { value: "TN51", title: "TN51" },
        ],
        setting: "mode",
    });
    l.layout.push({
        type:    "dropdown",
        title:   "Source for Convenience Switch",
        values:  [
            { value: "CD", title: "CD"        },
            { value: "AX", title: "Aux/SLS"   }
        ],
        setting: "source",
    });
    l.layout.push({
        type:    "integer",
        title:   "Initial Volume",
	min:     1,
	max:     99,
        setting: "initialvolume",
    });

    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(makelayout(mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
	let l = makelayout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!isdryrun && !l.has_error) {
            var oldport = mysettings.serialport;
            mysettings = l.values;
            svc_settings.update_settings(l);
            if (oldport != mysettings.serialport) setup_serial_port(mysettings.serialport);
            roon.save_config("settings", mysettings);
        }
    }
});

var svc_status = new RoonApiStatus(roon);
var svc_volume_control = new RoonApiVolumeControl(roon);
var svc_source_control = new RoonApiSourceControl(roon);

roon.init_services({
    provided_services: [ svc_volume_control, svc_source_control, svc_settings, svc_status ]
});

function setup_serial_port(port) {
    meridian.rs232.stop();
    if (meridian.source_control) { meridian.source_control.destroy(); delete(meridian.source_control); }
    if (meridian.volume_control) { meridian.volume_control.destroy(); delete(meridian.volume_control); }

    if (port)
        meridian.rs232.start(port, { volume: mysettings.volume, source: mysettings.source });
    else
        svc_status.set_status("Not configured, please check settings.", true);
}

setup_serial_port(mysettings.serialport);
    
function ev_connected(status) {
    let rs232 = meridian.rs232;

    console.log("[Meridian Extension] Connected");

    svc_status.set_status("Connected to Meridian RS232", false);

    rs232.set_volume(mysettings.initialvolume);
    rs232.set_source(mysettings.source);

    meridian.volume_control = svc_volume_control.new_device({
	state: {
	    display_name: "Meridian", // XXX need better less generic name -- can we get serial number from the RS232?
	    volume_type:  "number",
	    volume_min:   1,
	    volume_max:   99,
	    volume_value: rs232.properties.volume > 0 ? rs232.properties.volume : 65,
	    volume_step:  1.0,
	    is_muted:     rs232.properties.source == "MU"
	},
	set_volume: function (req, mode, value) {
	    let newvol = mode == "absolute" ? value : (rs232.properties.volume + value);
	    if      (newvol < this.state.volume_min) newvol = this.state.volume_min;
	    else if (newvol > this.state.volume_max) newvol = this.state.volume_max;
	    rs232.set_volume(newvol);
	    req.send_complete("Success");
	},
	set_mute: function (req, action) {
	    if (action == "on")
		rs232.mute();
	    else if (action == "off")
		rs232.set_source(mysettings.source);
	    else if (rs232.properties.source == "MU")
		rs232.set_source(mysettings.source);
	    else
		rs232.mute();
	    req.send_complete("Success");
	}
    });

    meridian.source_control = svc_source_control.new_device({
	state: {
	    display_name:     "Meridian", // XXX need better less generic name -- can we get serial number from the RS232?
	    supports_standby: true,
	    status:           rs232.properties.source == "SB" ? "standby" : (rs232.properties.source == mysettings.source ? "selected" : "deselected")
	},
	convenience_switch: function (req) {
	    rs232.set_source(mysettings.source, err => { req.send_complete(err ? "Failed" : "Success"); });
	    req.send_complete("Success");
	},
	standby: function (req) {
	    this.state.status = "standby";
	    rs232.standby();
	    req.send_complete("Success");
	}
    });

}

function ev_disconnected(status) {
    let rs232 = meridian.rs232;

    console.log("[Meridian Extension] Disconnected");

    svc_status.set_status("Could not connect to Meridian RS232 on \"" + mysettings.serialport + "\"", true);
    if (meridian.source_control) { meridian.source_control.destroy(); delete(meridian.source_control); }
    if (meridian.volume_control) { meridian.volume_control.destroy(); delete(meridian.volume_control);   }
}

function ev_volume(val) {
    let rs232 = meridian.rs232;
    console.log("[Meridian Extension] received volume change from device:", val);
    if (meridian.volume_control)
        meridian.volume_control.update_state({ volume_value: val });
}
function ev_source(val) {
    let rs232 = meridian.rs232;
    console.log("[Meridian Extension] received source change from device:", val);
    if (val == "MU" && meridian.volume_control)
        meridian.volume_control.update_state({ is_muted: true });
    else if (val == "SB" && meridian.source_control)
        meridian.source_control.update_state({ status: "standby" });
    else {
	if (meridian.volume_control)
	    meridian.volume_control.update_state({ is_muted: false });
	meridian.source_control.update_state({ status: (val == mysettings.source ? "selected" : "deselected") });
    }
}

meridian.rs232.on('connected', ev_connected);
meridian.rs232.on('disconnected', ev_disconnected);
meridian.rs232.on('volume', ev_volume);
meridian.rs232.on('source', ev_source);

roon.start_discovery();
