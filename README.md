# WebRemote for FlyByWire's A32NX

## Introduction

WebRemote for FBW A32NX is a customizable **browser-based remote control** for [FlyByWire Simulation's A32NX](https://flybywiresim.com). It is free and works with any modern PC, tablet or phone.

![screenshot](https://user-images.githubusercontent.com/17183796/213882716-094afb5a-c80a-4d4e-94a3-9e28c6a0bd40.jpg)

## Table of Contents

- [Philosophy](#philosophy)
- [Setup](#setup)
  - [Prerequesites](#prerequesites)
  - [Local Setup](#local-setup)
  - [High Convenience Setup](#high-convenience-setup-recommended-but-optional)
  - [Remote Setup](#remote-setup-optional)
- [Quickguide](#quickguide)
- [Support](#support-bug-reports-and-feature-requests)
- [License](#license)
- [Contact](#contact--collaboration)

## Philosophy

WebRemote was created to manage the aircraft systems that a flight crew most frequently interacts with during a normal flight, so that immersion-breaking use of the mouse cursor is almost not necessary anymore. This is especially useful when using a VR headset, where a second person, i.e. pilot monitoring, can assist the pilot flying. WebRemote works best when used in conjunction with FlyByWire's own SimBridge MCDU.

With that in mind, please note that
 - WebRemote does **not** aim to replace cockpit indications like FMAs or any gauges,
 - dimensions were deliberately chosen to facilitate the use of **touch screens**,
 - most numeric values are **entered directly** instead of using real-world in- and decrement functions.
 
It is best to think of it more like an instructor's station rather than an external cockpit simulator!

## Setup

There are different options to run WebRemote. They build on top of each other, so if you are unsure which one to use, just follow this guide step by step until the setup fits your needs.

### Prerequesites

You need the following programs installed and running:
 - [Microsoft Flight Simulator](https://www.flightsimulator.com) (2020 version)
 - [FlyByWire's add-on A32NX](https://flybywiresim.com) (WebRemote is tested with the current development version)
 - [FSUIPC7 for MSFS](http://www.fsuipc.com) (the free/unregistered version is sufficient)
 - [FSUIPC WebSockets Server](http://fsuipcwebsockets.paulhenty.com) (already bundled with FSUIPC, but you have to enable "Auto-Start" under "Add-ons")

### Local Setup

1. Download `a32nx-webremote` and unpack it to a local folder of your choice.
2. Locate the file `myOffsets.txt` in the `extras/FSUIPC7/` subfolder and copy it to the FSUIPC installation folder. Restart FSUIPC.
3. Locate the file `index.html` in the `web` subfolder and open it in your browser.
4. If you are running FSUIPC WebSockets with its default settings, enter `ws://localhost:2048/fsuipc/` for the WebSocket URL and click "Connect".
5. If a local setup is all you want, you are now done and may continue with the [quickguide](#quickguide).

### High Convenience Setup (recommended but optional)

Instead of downloading a packaged release bundle you could clone the git repository with a git-client of your choice (for example [GitHub's own client](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)).

WebRemote's `main` branch, even though considered a development branch, should always be in a stable state and will probably give you a better experience than an older release-snapshot.

Keep in mind that during upgrades you would still have to manually copy `myOffsets.txt` as described in [Local Setup](#local-setup). You can avoid that by creating a symlink of the same name from FSUIPC's installation directory to WebRemote's using the [mklink](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/mklink) command.

You are now able to coveniently upgrade WebRemote for FBW A32NX with the click of a button!

### Remote Setup (optional)

We will assume you are running MSFS, FSUIPC and FSUIPC WebSockets Server all on Machine **(A)** (with an example IP address of `10.0.0.2`) and want to use WebRemote on another device, called Machine **(B)**. We will also assume both machines are connected via a LAN. This leaves us with two problems to be solved:

1. How do we get the WebRemote, i.e. the content of `a32nx-webremote/web`, to **(B)**?
2. How do we transfer data from FSUIPC WebSockets running on **(A)** to WebRemote running on **(B)** and back?

The (only good) solution to problem #2 is the same either way and we will walk through it further down. For problem #1 there are basically two options:

#### Solving Problem 1

##### Variant 1

1. Extract a copy of `a32nx-webremote`, to **(B)** and locally (on **(B)**) open it in a browser, like you did during the local setup.
2. For the WebSocket URL you have to use the IP address of **(A)** and the port you will choose in Step [Solving Problem 2](#solving-problem-2). In our example it would be `ws://10.0.0.2:81/fsuipc/`.

This variant might be simpler if you are running WebRemote on just a single device, as it is pretty much a local setup on **(B)**. But WebRemote can also run on multiple devices **(C)**, **(D)** and so on. You probably do not want to keep all those installations up-to-date and synchronized separately, and this is where [Variant 2](#variant-2) will help you.

##### Variant 2

For this we will install our own webserver on **(A)**. Assuming **(A)** is running Microsoft Windows (which it most probably is, if it runs MSFS), IIS, Microsoft's own webserver, can be installed for free.

1. To install IIS, open "Turn Windows features on or off" and select "Internet Information Services". The subselection should already be set with reasonable defaults. Additonally, to solve problem #2 later,  make sure "WebSocket Protocol" is checked.
2. Open the "Internet Information Services (IIS) Manager" and locate the "Default Site".
3. As the exact steps change with each version of IIS, it would be of no use to go into too much detail here, but you want to assure the following:
   - The *physical path* of the site points to the `a32nx-webremote/web` folder.
   - The *binding* of the site points to **(A)**'s IP address (and *not* `localhost`). In our example this would be `10.0.0.2` with a port of `80`.
   - The IIS user has the *permission* to read from the physical path.
4. If everything was done correctly a browser on **(A)** can now be opened and WebRemote will run when entering **(A)**'s own IP address (*not* `localhost`).
5. If Step 4 was successful repeat it on **(B)** (still using **(A)**'s IP address). If this does not work, you will have to open the Default Site's port in **(A)**'s firewall, called Microsoft Defender.

You can now use WebRemote on as many devices as you want and update them all centrally on **(A)**! This is also the preferred variant, because we need the IIS in the next step anyways. Conveniently, IIS starts automatically with windows and once it is set up correctly you do not have to think about it again.

There are of course many other versions to get the data across, like shared network folders etc., but to mention all of these is out of the scope of this guide.

#### Solving Problem 2

Until now FSUIPC WebSockets has been listening on `localhost` and thus has only been accepting connections from "inside" of **(A)**. In order for it to accept connections from the LAN, it would need to listen on **(A)**'s public IP address instead, i.e. `10.0.0.2`. A program needs administrator privileges for that - with good reason. Even more, because WebSockets, FSUIPC and MSFS are talking to each other directly via their processes, they *all* would have to run with administrator privileges.

Running all three programs with administrator privileges definitely works, ***but is wrong on so many levels***! Do not do this. Not only is it a ***huge security risk*** but also completely unnecessary. Here is a cleaner and better solution:

We will use the IIS that we just set up as a *forward proxy*. That means it will listen on a second "outside" port (for our example let's use `10.0.0.2:81`) and forward whatever is sent there to the "inside" port of `localhost:2048` where FSUIPC WebSockets is listening.

1. Install two extra modules to the IIS: "[URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)" and "[Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)".
2. In the IIS Manager create a new Site next to the Default Site.
   - The *physical path* of the site points to an empty dummy folder of your choice.
   - The *binding* of the site points to **(A)**'s IP address. In our example this would be `10.0.0.2` with a port of `81`.
   - The name of the site does not matter.
3. In the new site's settings open the URL Rewrite feature and add a new *Inbound Rule*.
   - It should match the pattern `(.*)`, which means "any incoming request".
   - For the rule's *action* select `Rewrite` as type and `http://localhost:2048/{R:1}` as Rewrite URL.
   - Check "Append query string".
4. In the new site's "Configuration Editor" locate the `system.webServer/webSocket` section and assure "enabled" is set to `true`.
5. In the "Server Proxy Settings" for the "Application Request Routing Cache" check "Enable proxy". 

You are done! Following our example you can now open `http://10.0.0.2` in a browser on machine **(B)** or any other device connected to the LAN. There you enter `ws://10.0.0.2:81/fsuipc/` for the Socket URL and WebRemote is connected to your A32NX. :sunglasses:

## Quickguide

After connecting to FSUIPC WebSocket (and if all programs mentioned in the [prerequesites](#prerequesites) are running and connected to each other) you may chose which widgets you want to display via the buttons in the menu. The menu can be collapsed to gain more screen real estate.

All widgets can be positioned and some can be resized. Some widgets have a help button in the upper right corner with some additional information.

Not all information will be populated before the simulation is running, i.e. before you have clicked on "ready to fly" in MSFS.

### Configuration

WebRemote stores its configuration in the hash part (that comes after the `#`) of the URL. The following parameters are included:

- The WebSocket URL in use
- The state of the "autoconnect" checkbox
- The position and size of all open widgets
- The state of the menu (expanded or collapsed)

So if you want to save a certain layout, just save the current URL as bookmark in your browser. This way WebRemote can remain a completely static solution while you can still save as many different bookmarks (i.e. configurations) for different scenarios, browser tabs, devices and so on as you like. These URLs can also be copied to other devices where they still work the same.

## Support, Bug Reports and Feature Requests

If you want to report a bug, please check first on the [issues page](https://github.com/paulalexandrow/a32nx-webremote/issues), if your problem is already known. If not, any feedback, suggestion or feature request is always welcome of course!

In case of any problems with installing or running WebRemote, you can [contact](#contact--collaboration) me directly. I will try to answer all inquiries in a timely manner, but please keep in mind that this is a non-profit project I work on in my spare time. 

## License

WebRemote for A32NX is released under the [GNU GPLv3](LICENSE).

## Contact & Collaboration

WebRemote for A32NX was developed by [Paul Alexandrow](http://www.alexandrow.org), freelance software developer based in Vienna, Austria.

If you want to **contribute** to this project you are welcome to contact me anytime!

If you want to **donate** let me redirect your generosity [here](https://opencollective.com/flybywire). (not affiliated)
