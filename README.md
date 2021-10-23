# [Roon](https://roonlabs.com) [Extension](node-roon-api) to provide [source switching, standby](https://github.com/RoonLabs/node-roon-api-source-control), and [volume control](https://github.com/RoonLabs/node-roon-api-volume-control) for [Meridian Audio](http://meridian-audio.com/)'s range of devices via [RS232](https://github.com/RoonLabs/node-meridian-rs232)

This extension connects to your Meridian device (wether it be speakers, a surround processor, or something else) via RS232, and allows Roon to control it's volume directly, as well as standby, and convience source switching.

Meridian's own endpoints do this already using the Sooloos streaming protocol, which Roon supports already, but this is for users of Meridian gear that don't want Sooloos audio endpoints.
For example, let's say you have your SPDIF directly into a pair of Meridian DSP speakers using an AC12.

---------------------

Meridian's RS232 protocols for each device are slightly different.  The first protocol implemented here is "TN51".

TN51 is based on the Meridian document Titled:

	Technical Note TN51.2
	10th November 2014
	DSP Loudspeaker RS232 Control

This document claims that the protocol works for the following products/versions:

	DSP520: 1.1.0 or higher
	DSP640: 1.1.0 or higher
	M6: 1.1.0 or higher
	DSW: 1.1.0 or higher
	DSP3200: 1.2.0 or higher
	DSP3300: 1.2.0 or higher

I can also personally confirm this also works for DSP7200 1.0.0 and the DSP7200SE upgrade-kit.

---------------------

If your device is not on this list(s) above, It isn't hard to add support for
it, but I will need to iterate via Skype with you a few times. I'm happy to do
this, but you should have the rest of the setup properly done.

This is my personal setup:

    Roon Nucleus
	-> USB Serial port adapter -> RS232 Serial cable -> Meridian AC12
	-> USB BelCanto uLink -> SPDIF coax cable -> Meridian AC12
	-> USB Griffin Powermate knob

    AC12 -> speakerlink -> DSP7200

    Notes:
	- I used that BelCanto uLink because I had it lying around. Any
	  USB->CoaxSPDIF converter will work. You could even use an
	  HDMI->CoaxSPDIF converter because the Nucleus's HDMI port is active as a sound
	  device.
	- The knob is important to me because I wanted less hardware in the room,
	  so was happy to swap out a G61R or AC200 for a USB knob.
	- The AC12 is also important in my setup because my speakers are
	  speakerlink only. The AC12 is a passive device that breaks out the pins
	  from an RJ45 jack into RS232 + SPDIF (It also does Comms, but we dont
          care about that).

    I run 2 extensions:
       - The [Powermate extension](https://github.com/RoonLabs/roon-extension-powermate) to speak to the knob
       - This extension to speak to the Meridian Speakers.

What my experience is like:

       Nucleus + DSP7200 w/ full volume control, muting, standby, waking/convienience switching.

       I just go into Roon and play music, and it turns on the speakers, sets
       the volume, and all is good. In Roon there is also a button to standby the
       speakers.

       Minus multiple sources support, this is the same experience without the AC200, G61R, 818, etc..

----------------

XXX TODO XXX

explain how to enable the extensions, set them up properly, connect them to zones, etc...

