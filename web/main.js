/*
This program is free software: you can redistribute it and/or modify it
under the terms of the GNU General Public License as published by the
Free Software Foundation; either version 3 of the License, or (at your
option) any later version.

This program is distributed in the hope that it will be useful, but
WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
General Public License for more details.

You should have received a copy of the GNU General Public License along
with this program. If not, see https://www.gnu.org/licenses/.
*/

$(function() {

	// Completely disable jQueryUI's autofocus. It does more harm than good in our case.
	$.ui.dialog.prototype._focusTabbable = $.noop;

	let socket = null;
	let lvars = {};
	let offsets = {};
	let inhibitUpdateHash = false;
	let retryConnection = false;

	let initializeSocket = function() {
		if (socket != null) return;
		try {
			socket = new WebSocket($("#socketURL").val(), "fsuipc");
			socket.onopen = function() {
				// declare LVARs
				socket.send(JSON.stringify({
					command: "vars.declare",
					name: "fcuVars",
					vars: $.map(lvars, function(val, key) { return { name:key } })
				}));
				// subscribe to declared LVARs
				socket.send(JSON.stringify({
					command: "vars.read",
					name: "fcuVars",
					interval: 100
				}));
				// declare offset requests
				socket.send(JSON.stringify({
					command: "offsets.declare",
					name: "fcuOffsets",
					offsets: $.map(offsets, function(val, key) { return { name:key, address:val["offsetaddress"], type:val["offsettype"], size:val["offsetsize"] } })
				}));
				// read offset requests
				socket.send(JSON.stringify({
					command: "offsets.read",
					name: "fcuOffsets",
					interval: 100
				}));
				$("#connectionPanel").dialog("close");
				$("#menu").removeClass("disabled");
				applyShieldConfig();
				if ($('.shieldDialog:visible').length == 0) openMenu(true);
				retryConnection = true;
			};
			socket.onclose = function() {
				socket = null;
				// We need to retry to connect at least once, because failures are common with FSUIPC WebSocket.
				if (retryConnection) {
					initializeSocket();
					retryConnection = false;
				} else {
					inhibitUpdateHash = true;
					$(".shield").dialog("close");
					$("#connectionPanel").dialog("open");
					$("#menu").addClass("disabled");
					inhibitUpdateHash = false;
				}
			};
			socket.onerror = function() {
				alert("A socket error occurred.");
			};
			socket.onmessage = function(msg) {
				let response = JSON.parse(msg.data);
				if (response.success) {
					switch (response.command) {
						case "vars.read":
							updateLvars(response.data);
							break;
						case "offsets.read":
							updateOffsets(response.data);
							break;
					}
				} else {
					alert("The server reported a problem: " + response.errorMessage);
				}
			};
		} catch(ex) {
			alert("Could not open the web socket: " + ex.toString());
		}
	};

	$("#disconnectButton").click(function() {
		retryConnection = false;
		if (socket != null) {
			socket.close();
		}
	});

	let openMenu = function(instantly) {
		$("#menu").removeClass("collapsed", instantly ? 0 : 500, function() {
			$('#openMenuAction').hide();
			$('#closeMenuAction').show();
		});
		updateHash({ "m": "1" });
	};

	let closeMenu = function() {
		$("#menu").addClass("collapsed", 500, function() {
			$('#closeMenuAction').hide();
			$('#openMenuAction').show();
		});
		updateHash({ "m": null });
	};

	$('#openMenuAction').click(function() { openMenu(false) });
	$('#closeMenuAction').click(function() { closeMenu() });

	let readHash = function() {
		if (window.location.hash.length < 2 || !window.location.hash.startsWith("#")) return {};

		let result = {};
		let params = new URLSearchParams(window.location.hash.substr(1));
		for (const [key, val] of params.entries()) {
			// we have no duplicate keys, so this is save
			if (key == "c") {
				try {
					result[key] = JSON.parse(atob(val));
				} catch (ex) { /* fail silently */ }
			} else {
				result[key] = val;
			}
		}
		return result;
	};

	let updateHash = function(p) {
		if (inhibitUpdateHash) return;

		let params = new URLSearchParams((window.location.hash.length < 2 || !window.location.hash.startsWith("#") ? undefined : window.location.hash.substring(1)));
		$.each(p, function(key, val) {
			if (params.has(key)) params.delete(key);
			if (val) {
				if (key == "c") {
					params.set(key, btoa(JSON.stringify(val)));
				} else {
					params.set(key, val);
				}
			}
		});
		window.location.hash = "#" + params.toString();
	};


	let updateShieldConfig = function() {
		let config = []; // We want to save as much data as (URL length) possible, so we go with arrays and fixed indexes instead of an object with keys.
		$(".shield").each(function() {
			if ($(this).dialog("isOpen")) {
				let o = $(this).dialog("widget").offset();
				config.push([
					$(this).attr("id"),
					Math.round(o.top),
					Math.round(o.left),
					$(this).dialog("option", "width"),
					$(this).dialog("option", "height")
				]);
			}
		});

		updateHash({ "c": (config.length > 0) ? config : null});
	};

	let applyShieldConfig = function() {
		inhibitUpdateHash = true;
		let p = readHash();
		if (p["c"]) {
			$.each(p["c"], function(idx, val) {
				let shield = $("#" + val[0]);
				shield.dialog("open");
				shield.css("overflow", "hidden");
				shield.dialog("option", "width", val[3]);
				shield.dialog("option", "height", val[4]);
				shield.css("overflow", "auto");
				shield.dialog("widget").position({
					my: "left top",
					at: "left+" + val[2] + " top+" + val[1],
					of: "body"
				});
			});
		}
		if (p["m"]) {
			openMenu(true);
		}
		if (p["g"]) {
			$(".buttonGroup.switchGroup").hide();
			$("#" + p["g"]).show();
		}
		inhibitUpdateHash = false;
	};

	let updateLvars = function(data) {
		$.each(data, function(key, val) {
			if (lvars.hasOwnProperty(key)) {

				// First, some necessary hardcoded treatments for...
				// ... SPD/MACH
				if (key == "A32NX_AUTOPILOT_SPEED_SELECTED") {
					if (val <= 1) {
						// mach
						$("#indicator_spd_spd").hide();
						$("#indicator_spd_mach").show();
					} else {
						// spd
						$("#indicator_spd_spd").show();
						$("#indicator_spd_mach").hide();

					}
				}
				// ... VS/FPA
				if (key == "A32NX_TRK_FPA_MODE_ACTIVE") {
					if (val) {
						$("#indicator_vs_vs").hide();
						$("#indicator_vs_fpa").show();
					} else {
						$("#indicator_vs_vs").show();
						$("#indicator_vs_fpa").hide();

					}
				}
				// ... BARO
				if (key == "XMLVAR_Baro1_Mode" && val == "3") val = "2";
				if (key == "XMLVAR_Baro_Selector_HPA_1") {
					if (val == 1) {
						// hPa
						$("#indicator_baro_inhg").hide();
						$("#indicator_baro_hpa").show();
					} else {
						// inHg
						$("#indicator_baro_inhg").show();
						$("#indicator_baro_hpa").hide();

					}
				}
				// ... SPOILERS
				if (key == "A32NX_SPOILERS_HANDLE_POSITION") {
					$("#spoilerSlider").slider("value", 1 - val);
				}

				// now the generic stuff
				switch (lvars[key].type) {
					case "selector_button":
						$(".lvar_selector_button[data-lvarname='" + key + "\']").removeClass("ui-state-active");
						$(".lvar_selector_button[data-lvarname='" + key + "\'][data-lvarvalue='" + val + "']").addClass("ui-state-active");
						updateBaro(); // some hardcoded necessity
						break;
					case "status_indicator":
						$(".lvar_status_indicator[data-lvarname='" + key + "\']").removeClass("ui-state-active");
						$(".lvar_status_indicator[data-lvarname='" + key + "\'][data-highlightvalue='" + val + "']").addClass("ui-state-active");
						$(".lvar_status_indicator[data-lvarname='" + key + "\'][data-alternativehighlightvalue='" + val + "']").addClass("ui-state-active");
						break;
					case "value_indicator":
						$(".lvar_value_indicator[data-lvarname='" + key + "\']").each(function() {
							let value = parseFloat(val);
							if ($(this).data("placeholder") && data.hasOwnProperty($(this).data("placeholdertriggerlvar")) && data[$(this).data("placeholdertriggerlvar")]) {
								$(this).text($(this).data("placeholder"));
							} else {
								let str;
								if ($(this).data("fractiondigits")) {
									str = value.toFixed($(this).data("fractiondigits"));
								} else {
									str = value.toString();
								}
								str = $(this).data("padzeros") ? padZeros(str, $(this).data("padzeros")) : str;
								if (str.substring(0,1) != "-" && $(this).data("alwaysshowsign")) {
									str = "+" + str;
								}
								$(this).text(str);
							}
							$(this).data("lastvalue", $(this).text());
						});
						break;
				}
			}
		});

		// more hardcoded logic for the spoilers
		if ($(".lvar_status_indicator[data-lvarname=A32NX_SPOILERS_ARMED]").hasClass("ui-state-active")) {
			$(".lvar_status_indicator[data-lvarname=A32NX_SPOILERS_HANDLE_POSITION").removeClass("ui-state-active");
		}
	};

	let updateOffsets = function(data) {
		$.each(data, function(key, val) {
			if (offsets.hasOwnProperty(key)) {
				switch (offsets[key].type) {
					case "status_indicator":
						$(".offset_status_indicator[data-offsetaddress=\'" + key + "\']").removeClass("ui-state-active");
						$(".offset_status_indicator[data-offsetaddress=\'" + key + "\'][data-highlightvalue='" + val + "']").addClass("ui-state-active");
						break;
					case "value_indicator":
						$(".offset_value_indicator[data-offsetaddress=\'" + key + "\']").each(function() {
							let value = parseFloat(val);
							if ($(this).data("displayfactor")) {
								value = value * parseFloat($(this).data("displayfactor"));
							}
							let str;
							if ($(this).data("fractiondigits") !== undefined) {
								str = value.toFixed($(this).data("fractiondigits"));
							} else {
								str = value.toString();
							}
							$(this).data("lastvalue", $(this).data("padzeros") ? padZeros(str, $(this).data("padzeros")) : str);
							$(this).text($(this).data("lastvalue"));
						});
						updateBaro(); // some hardcoded necessity
						break;
					case "percent_slider":
						$(".offset_percent_slider[data-offsetaddress=\'" + key + "\']").each(function() {
							$(this).slider("value", val);
						});
						break;
				}
			}
		});
	};

	// Baro behavior is special and needs to be hardcoded
	let updateBaro = function() {
		if ($("#button_baro_mode_std").hasClass("ui-state-active")) {
			$(".qnh_indicator").text("Std");
		} else {
			$(".qnh_indicator").each(function() {
				$(this).text($(this).data("lastvalue"));
			});
		}
	}

	let consumeScratchpad = function() {
		let result = $("#scratchpad").text();
		$("#scratchpad").text("");

		if (result == "") return -1; // will just fail silently

		result = parseInt(result);
		if (isNaN(result)) {
			alert("Invalid scratchpad content.");
			return -1;
		}

		return result;
	}

	let padZeros = function(str, count) {
		// Dragon: There is a reason we work so clumsily with strings here. Do not refactor to numbers.
		let negative = false;
		if (str.substring(0,1) == "-") {
			str = str.substr(1);
			negative = true;
		}

		return (negative ? "-" : "") + str.padStart(count, "0");
	}

	// parse LVARs from document
	$(".lvar_selector_button").each(function() {
		if (!lvars.hasOwnProperty($(this).data("lvarname"))) {
			lvars[$(this).data("lvarname")] = { type:"selector_button" };
		}
	});
	$(".lvar_status_indicator").each(function() {
		if (!lvars.hasOwnProperty($(this).data("lvarname"))) {
			lvars[$(this).data("lvarname")] = { type:"status_indicator" };
		}
	});
	$(".lvar_value_indicator").each(function() {
		if (!lvars.hasOwnProperty($(this).data("offsetname"))) {
			lvars[$(this).data("lvarname")] = { type:"value_indicator" };
		}
	});

	// parse offsets from document
	$(".offset_status_indicator").each(function() {
		if (!offsets.hasOwnProperty($(this).data("offsetaddress").toString())) {
			offsets[$(this).data("offsetaddress").toString()] = {
				type: "status_indicator",
				offsetaddress: parseInt($(this).data("offsetaddress")),
				offsettype: $(this).data("offsettype"),
				offsetsize: parseInt($(this).data("offsetsize"))
			};
		}
	});
	$(".offset_value_indicator").each(function() {
		if (!offsets.hasOwnProperty($(this).data("offsetaddress").toString())) {
			offsets[$(this).data("offsetaddress").toString()] = {
				type: "value_indicator",
				offsetaddress: parseInt($(this).data("offsetaddress")),
				offsettype: $(this).data("offsettype"),
				offsetsize: parseInt($(this).data("offsetsize"))
			};
		}
	});
	$(".offset_percent_slider").each(function() {
		if (!offsets.hasOwnProperty($(this).data("offsetaddress").toString())) {
			offsets[$(this).data("offsetaddress").toString()] = {
				type: "percent_slider",
				offsetaddress: parseInt($(this).data("offsetaddress")),
				offsettype: $(this).data("offsettype"),
				offsetsize: parseInt($(this).data("offsetsize"))
			};
		}
		let calcCode = $(this).data("calculatorcommand");
		$(this).slider({
			range: "max",
			min: 0,
			max: 100,
			step: 1,
			value: 0,
			animate: "slow",
			stop: function(e, u) {
				if (socket == null) return;
				socket.send(JSON.stringify({
					command: "vars.calc",
					name: "calc",
					code: calcCode.replace("{0}", u.value.toString())
				}));
			}
		});
	});

	$("#scratchpadButtons button").click(function() {
		if ($(this).data("value") === "") {
			$("#scratchpad").text("");
		} else if ($(this).data("value") == "-") {
			if ($("#scratchpad").text().startsWith("-")) {
				$("#scratchpad").text($("#scratchpad").text().substring(1));
			} else {
				$("#scratchpad").text("-" + $("#scratchpad").text());
			}
		} else {
			$("#scratchpad").text($("#scratchpad").text() + $(this).data("value"));
		}
	});

	$(".scratchpad_calculator_command").click(function() {
		if (socket == null) return;
		let value = consumeScratchpad();
		if (value < $(this).data("minvalue") || value > $(this).data("maxvalue")) return; // fail silently
		if ($(this).data("sendfactor")) {
			value = value * $(this).data("sendfactor");
		}
		socket.send(JSON.stringify({
			command: "vars.calc",
			name: "calc",
			code: value + " " + $(this).data("calculatorcommand")
		}));
	});

	$(".lvar_selector_button").click(function() {
		if (socket == null) return;
		let v;
		if (!$(this).hasClass("ui-state-active")) {
			v = $(this).data("lvarvalue");
		} else if (typeof $(this).data("lvardeselectvalue") !== "undefined") {
			v = $(this).data("lvardeselectvalue");
		} else {
			return; // this button is already active and has no deselectvalue
		}
		socket.send(JSON.stringify({
			command: "vars.write",
			vars:[{ name:$(this).data("lvarname"), value:v }]
		}));
	});

	$(".calculator_button").click(function() {
		if (socket == null) return;
		let commands;
		if ($(this).data("disablecalculatorcommands") && $(this).hasClass("ui-state-active")) {
			commands = $(this).data("disablecalculatorcommands").split("|");
		} else {
			commands = $(this).data("calculatorcommands").split("|");
		}
		for (let c in commands) {
			setTimeout(function() {
				socket.send(JSON.stringify({
					command: "vars.calc",
					name: "calc",
					code: commands[c]
				}));
			}, c * 100); // separate commands by 100ms by default (warn and caut buttons need this)
		}
	});

	$(".scratchpad_offset_target").click(function() {
		if (socket == null) return;
		let value = consumeScratchpad();
		if (value < $(this).data("minvalue") || value > $(this).data("maxvalue")) return; // fail silently
		if ($(this).data("sendfactor")) {
			value = value * $(this).data("sendfactor");
		}
		socket.send(JSON.stringify({
			command: "offsets.write",
			name: "fcuOffsets",
			offsets: [{ name:$(this).data("offsetaddress"), value:value }]
		}));
	});

	// Spoiler logic is so special and unique that we hardcode it.
	$("#spoilerSlider").slider({
		orientation: "vertical",
		range: "max",
		min: 0,
		max: 1,
		step: 0.01,
		value: 0,
		animate: "slow",
		stop: function(e, u) {
			if (socket == null) return;
			socket.send(JSON.stringify({
				command: "vars.calc",
				name: "calc",
				code: Math.round((1 - u.value) * 16384).toString() + " (>K:SPOILERS_SET)"
			}));
		}
    });

	$(".buttonGroup .header button").click(function() {
		$(".buttonGroup.switchGroup").hide();
		$("#" + $(this).data("targetgroup")).show();
		updateHash({ "g": $(this).data("targetgroup") });
	});

	$(".shieldButton").click(function() {
		let d = $("#" + $(this).data("targetshield"));
		if (d.dialog("isOpen")) {
			d.dialog("close");
		} else {
			d.dialog("open");
		}
	});

	$(".shield").each(function() {
		$(this).dialog({
			title: $(this).data("title"),
			autoOpen: false,
			resizable: $(this).data("noresize") ? false : true,
			classes: { "ui-dialog": "shieldDialog" },
			width: $(this).data("width") ? $(this).data("width") : undefined,
			height: $(this).data("height") ? $(this).data("height") : undefined,
			minHeight: 1,
			create: function() {
				// Unfortunately no official API for that, so still the cleanest way to achieve this in jQueryUI.
				$(".ui-dialog-titlebar", $(this).dialog("widget")).append($(".helpButton", this));
			},
			close: function() {
				$(".shieldButton[data-targetshield='" + $(this).attr("id") + "']").removeClass("ui-state-active");
				updateShieldConfig();
			},
			beforeClose: function() {
				let p = $(this).dialog("widget").position();
				$(this).data("lastPosition", { left: p.left, top: p.top }); // This position "save" will not survive in the URL, but in the current window. This is by design.
			},
			open: function() {
				$(".shieldButton[data-targetshield='" + $(this).attr("id") + "']").addClass("ui-state-active");
				if ($(this).data("lastPosition")) {
					$(this).dialog("widget").position({
						my: "left top",
						at: "left+" + $(this).data("lastPosition").left + " top+" + $(this).data("lastPosition").top,
						of: "body"
					});
				}
				updateShieldConfig();
			},
			dragStop: function() {
				updateShieldConfig();
			},
			resizeStop: function() {
				updateShieldConfig();
			}
		}).dialog("widget").draggable("option", "containment", "none"); // Still gold after 12 years. Thank you Kevin! (https://forum.jquery.com/topic/allowing-dialog-to-drag-beyond-edge-of-document)
	});

	$(".helpDialog").each(function() {
		$(this).dialog({
			title: $(this).data("title"),
			autoOpen: false,
			resizable: false,
			draggable: false,
			modal:true,
			classes: { "ui-dialog": "helpDialog" },
			width: $(this).data("width") ? $(this).data("width") : undefined,
			height: $(this).data("height") ? $(this).data("height") : undefined,
			minHeight: 1
		});
	});

	$(".helpButton").click(function() {
		$("#" + $(this).data("targetdialog")).dialog("open");
	});

	// actual "autostart" code below this line

	$("button").button().bind("mouseup", function() { $(this).blur(); });// jqueryui bug(?) workaround

	$(".controlgroup").controlgroup({
		onlyVisible: false
	});

	$(".controlgroupVertical").controlgroup({
		onlyVisible: false,
		direction: "vertical"
	});

	$("#connectionPanel").dialog({
			dialogClass: "connectionDialog",
			title: "WebRemote for FBW A32NX",
			modal: true,
			draggable: false,
			resizable: false,
			closeOnEscape: false,
			width: 500,
			height: 300,
			buttons: [
				{
					text: "Connect",
					click: function() {
						if (socket == null) {
							initializeSocket();
							updateHash({
								"socketurl":  $("#socketURL").val(),
								"autoconnect": $("#autoconnectField input").prop("checked") ? 1 : null
							});
						} else {
							alert("Connection already in progress. Please wait.");
						}
					}
				},
			]
	});

	let config = readHash();
	if (config["socketurl"]) {
		$("#socketURL").val(config["socketurl"]);
	} else if (!window.location.host || window.location.host == "localhost") {
		$("#socketURL").val("ws://localhost:2048/fsuipc/"); // best guess for local setup
	} else {
		$("#socketURL").val("ws://"  + window.location.host + "/fsuipc/");  // best guess for remote setup
	}
	if (config["autoconnect"]) {
		$("#autoconnectField input").prop("checked", true);
		initializeSocket();
	}

});