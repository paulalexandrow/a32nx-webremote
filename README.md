# WebRemote for FlyByWire's A32NX

## Introduction

WebRemote for FBW A32NX is a customizable **browser-based remote control** for [FlyByWire Simulation's A32NX](https://flybywiresim.com). It is free and works with any modern PC, tablet or phone.

![screenshot](https://user-images.githubusercontent.com/17183796/219950091-ba1c300b-e683-47e8-ba8a-3a71cca653a8.jpg)

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

I also recorded a video tutorial that explains the full setup process. Keep in mind though, that things could change over time and this README will always be master.

[![tutorial thumbnail](https://img.youtube.com/vi/_fMCXbj3bt8/mqdefault.jpg)](https://youtu.be/_fMCXbj3bt8)

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

WebRemote's `main` branch, should always be in a stable state and will probably give you more features and a better overall experience than an older release-snapshot.

Keep in mind that during upgrades you would still have to manually copy `myOffsets.txt` as described in [Local Setup](#local-setup). You can avoid that by creating a symlink of the same name from FSUIPC's installation directory to WebRemote's using the [mklink](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/mklink) command.

You are now able to coveniently upgrade WebRemote for FBW A32NX with the click of a button!

### Remote Setup (optional)

We will assume you are running MSFS, FSUIPC and FSUIPC WebSockets Server all on Machine **(A)** (with an example IP address of `192.168.0.2`, which you need to substitute for your own) and want to use WebRemote on another device, called Machine **(B)**. We will also assume both machines are connected via a LAN. This leaves us with two problems to be solved:

1. How do we get the WebRemote, i.e. the content of `a32nx-webremote/web`, to **(B)**?
2. How do we transfer data from FSUIPC WebSockets running on **(A)** to WebRemote running on **(B)** and back?

The (only good) solution to these problems is running a webserver on **(A)**. It is planned for WebRemote to come with its own webserver in the future, but until then it is recommended to use Windows' free and built-in server called IIS. (There are of course many other ways to do this, but to cover all of them is out of the scope of this guide.)

#### Install IIS

1. To install IIS, open "Turn Windows features on or off" and select "Internet Information Services". The subselection should already be set with reasonable defaults. Additionally,  make sure "WebSocket Protocol" is checked.
2. Download and install two extra modules for the IIS: "[URL Rewrite](https://www.iis.net/downloads/microsoft/url-rewrite)" and "[Application Request Routing](https://www.iis.net/downloads/microsoft/application-request-routing)".

#### Configure the Server

3. Open the "Internet Information Services (IIS) Manager", that was automatically installed alongside IIS.
4. Under "Application Request Routing Cache" → "Server Proxy Settings" check "Enable proxy". 

#### Configure the Default Site

5. On the left, locate "Default Web Site".
6. As the exact steps might change with different versions of IIS, it would be of no use to go into too much detail here, but you want to assure the following:
   - The *physical path* of the site points to the `a32nx-webremote/web` folder. (under "Basic Settings")
   - The *binding* of the site points to **(A)**'s IP address `192.168.0.2` (*not* `localhost`) with a port of `80`.  (under "Bindings")
7. Make sure the IIS user and group (normally called `IUSR` and `IIS_IUSRS`) have the *permission* to read from the physical path. This is not done in the IIS Manager program but in Windows' File Explorer.

To test the setup so far, open `http://192.168.0.2` (*not* `localhost`) in a browser on **(A)**. WebRemote's login mask should load (but will not work yet). If not, something went wrong and you should not continue with the setup.

#### Configure a Forward Proxy

Until now FSUIPC WebSockets has been listening on `localhost` and thus has only been accepting connections from "inside" of **(A)**. In order for it to accept connections from the LAN, it would need to listen on **(A)**'s public IP address instead, i.e. `192.168.0.2`. A program needs administrator privileges for that - with good reason. Even more, because WebSockets, FSUIPC and MSFS are talking to each other directly via their processes, they *all* would have to run with administrator privileges.

Running all three programs with administrator privileges definitely works, ***but is wrong on so many levels***! Do not do this. Not only is it a ***huge security risk*** but also completely unnecessary. Here is a cleaner and better solution:

We will use the IIS that we just set up as a *forward proxy*, that forwards whatever is sent to a certain adress to FSUIPC WebSockets' "inside" port of `localhost:2048`.

8. In the IIS Manager locate again the "Default Web Site".
9. In the "Configuration Editor" locate the `system.webServer/webSocket` section and assure "enabled" is set to `true`.
10. Under "URL Rewrite", add a new blank "Inbound Rule" set the following:
    - The *Pattern* to match: `fsuipc/(.*)`
    - The *Action type*: `Rewrite`
    - The *Rewrite URL*: `http://localhost:2048/fsuipc/{R:1}`

You are done! You can now use WebRemote on as many devices as you want and update them all centrally on **(A)**! Conveniently, IIS starts automatically with Windows and once it is set up correctly you do not have to think about it again.

 You can now open `http://192.168.0.2` in a browser on machine **(B)** or any other device connected to the LAN. There you should enter `ws://192.168.0.2/fsuipc/` for the Socket URL and WebRemote is connected to your A32NX. :sunglasses:

## Quickguide

After connecting to FSUIPC WebSocket (and if all programs mentioned in the [prerequesites](#prerequesites) are running and connected to each other) you may chose which widgets you want to display via the buttons in the menu. The menu can be collapsed to gain more screen real estate.

All widgets can be positioned and some can be resized. Some widgets have a help button in the upper right corner with some additional information.

Not all information will be populated before the simulation is running, i.e. before you have clicked on "ready to fly" in MSFS.

### Configuration

WebRemote stores its configuration in the hash part (that comes after the `#`) of the URL. The following parameters are included:

- The WebSocket URL in use
- The state of the "autoconnect" checkbox
- The position and size of all open widgets
- The position and content of the side-menu

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
