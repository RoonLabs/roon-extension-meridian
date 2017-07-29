"use strict";

var Meridian             = require("node-meridian"),
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
    ip:            "",
    setsource:     "CD",
    displaysource: "CD",
    initialvolume: 45,
    mode:          "TN51",
};

var meridian = { };

function makelayout(settings) {
    var l = { 
        values:    settings,
	layout:    [],
	has_error: false
    };

    l.layout.push({
        type:    "dropdown",
        title:   "Protocol Mode",
        values:  [
            { value: "TN49", title: "TN49" },
            { value: "TN51", title: "TN51" },
        ],
        setting: "mode",
    });
    if (settings.mode == "218") {
        l.layout.push({
            type:      "string",
            title:     "IP Address",
            maxlength: 15,
            setting:   "ip",
        });
    } else {
        l.layout.push({
            type:      "string",
            title:     "Serial Port",
            maxlength: 256,
            setting:   "serialport",
        });
    }

    l.layout.push({
        type:    "string",
        title:   "Source displayed on device (select source and see what speakers display)",
        maxlength: 5,
        setting: "displaysource",
    });

    l.layout.push({
        type:    "dropdown",
        title:   "Source for Convenience Switch",
        values:  [
            { value: "CD", title: "CD"              },
            { value: "RD", title: "Radio"           },
            { value: "LP", title: "LP/Aux/SLS"      },
            { value: "TV", title: "TV"              },
            { value: "T1", title: "Tape/Tape1/iPod" },
            { value: "T2", title: "Tape2/Sat"       },
            { value: "CR", title: "CDR/Disc"        },
            { value: "CB", title: "Cable"           },
            { value: "TX", title: "Text/DVD"        },
            { value: "V1", title: "VCR1/Mixer/PVR"  },
            { value: "V2", title: "VCR2/USB"        },
            { value: "LD", title: "LDisc/Game"      }
        ],
        setting: "setsource",
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
    if (meridian.control)
        meridian.control.stop();

    meridian.control = new Meridian(mysettings.mode);

    meridian.control.on('connected', ev_connected);
    meridian.control.on('disconnected', ev_disconnected);
    meridian.control.on('volume', ev_volume);
    meridian.control.on('source', ev_source);

    if (meridian.source_control) { meridian.source_control.destroy(); delete(meridian.source_control); }
    if (meridian.volume_control) { meridian.volume_control.destroy(); delete(meridian.volume_control); }

    if (port)
        meridian.control.start({ port: port, volume: mysettings.initialvolume, source: mysettings.setsource });
    else
        svc_status.set_status("Not configured, please check settings.", true);
}

setup_serial_port(mysettings.serialport);
    
function ev_connected(status) {
    let control = meridian.control;

    console.log("[Meridian Extension] Connected");

    svc_status.set_status("Connected to Meridian RS232", false);

    control.set_volume(mysettings.initialvolume);
    control.set_source(mysettings.setsource);

    meridian.volume_control = svc_volume_control.new_device({
	state: {
	    display_name: "Meridian", // XXX need better less generic name -- can we get serial number from the RS232?
	    volume_type:  "number",
	    volume_min:   1,
	    volume_max:   99,
	    volume_value: control.properties.volume > 0 ? control.properties.volume : 65,
	    volume_step:  1.0,
	    is_muted:     control.properties.source == "Muted"
	},
	set_volume: function (req, mode, value) {
	    let newvol = mode == "absolute" ? value : (control.properties.volume + value);
	    if      (newvol < this.state.volume_min) newvol = this.state.volume_min;
	    else if (newvol > this.state.volume_max) newvol = this.state.volume_max;
	    control.set_volume(newvol);
	    req.send_complete("Success");
	},
	set_mute: function (req, action) {
	    if (action == "on")
		control.mute();
	    else if (action == "off")
		control.set_source(mysettings.setsource);
	    else if (control.properties.source == "Muted")
		control.set_source(mysettings.setsource);
	    else
		control.mute();
	    req.send_complete("Success");
	}
    });

    meridian.source_control = svc_source_control.new_device({
	state: {
	    display_name:     "Meridian", // XXX need better less generic name -- can we get serial number from the RS232?
	    supports_standby: true,
	    status:           control.properties.source == "Standby" ? "standby" : (control.properties.source == mysettings.displaysource ? "selected" : "deselected")
	},
	convenience_switch: function (req) {
	    control.set_source(mysettings.setsource, err => { req.send_complete(err ? "Failed" : "Success"); });
	    req.send_complete("Success");
	},
	standby: function (req) {
	    this.state.status = "standby";
	    control.standby();
	    req.send_complete("Success");
	}
    });

}

function ev_disconnected(status) {
    let control = meridian.control;

    console.log("[Meridian Extension] Disconnected");

    svc_status.set_status("Could not connect to Meridian RS232 on \"" + mysettings.serialport + "\"", true);
    if (meridian.source_control) { meridian.source_control.destroy(); delete(meridian.source_control); }
    if (meridian.volume_control) { meridian.volume_control.destroy(); delete(meridian.volume_control);   }
}

function ev_volume(val) {
    let control = meridian.control;
    console.log("[Meridian Extension] received volume change from device:", val);
    if (meridian.volume_control)
        meridian.volume_control.update_state({ volume_value: val });
}
function ev_source(val) {
    let control = meridian.control;
    console.log("[Meridian Extension] received source change from device:", val);
    if (val == "Muted" && meridian.volume_control)
        meridian.volume_control.update_state({ is_muted: true });
    else if (val == "Standby" && meridian.source_control)
        meridian.source_control.update_state({ status: "standby" });
    else {
	if (meridian.volume_control)
	    meridian.volume_control.update_state({ is_muted: false });
	meridian.source_control.update_state({ status: (val == mysettings.displaysource ? "selected" : "deselected") });
    }
}

roon.start_discovery();
