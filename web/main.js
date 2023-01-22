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

	var socket = null;
	var lvars = {};
	var offsets = {};
	var inhibitUpdateHash = false;
	var retryConnection = false;

	var initializeSocket = function() {
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
				var response = JSON.parse(msg.data);
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

	var openMenu = function(instantly) {
		$("#menu").removeClass("collapsed", instantly ? 0 : 500, function() {
			$('#openMenuAction').hide();
			$('#closeMenuAction').show();
		});
		updateHash({ "m": "1" });
	};

	var closeMenu = function() {
		$("#menu").addClass("collapsed", 500, function() {
			$('#closeMenuAction').hide();
			$('#openMenuAction').show();
		});
		updateHash({ "m": null });
	};

	$('#openMenuAction').click(function() { openMenu(false) });
	$('#closeMenuAction').click(function() { closeMenu() });

	var readHash = function() {
		if (window.location.hash.length < 2 || !window.location.hash.startsWith("#")) return {};

		var result = {};
		var params = new URLSearchParams(window.location.hash.substr(1));
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

	var updateHash = function(p) {
		if (inhibitUpdateHash) return;

		var params = new URLSearchParams((window.location.hash.length < 2 || !window.location.hash.startsWith("#") ? undefined : window.location.hash.substring(1)));
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


	var updateShieldConfig = function() {
		var config = []; // We want to save as much data as (URL length) possible, so we go with arrays and fixed indexes instead of an object with keys.
		$(".shield").each(function() {
			if ($(this).dialog("isOpen")) {
				var o = $(this).dialog("widget").offset();
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

	var applyShieldConfig = function() {
		inhibitUpdateHash = true;
		var p = readHash();
		if (p["c"]) {
			$.each(p["c"], function(idx, val) {
				var shield = $("#" + val[0]);
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
		inhibitUpdateHash = false;
	};

	var updateLvars = function(data) {
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
				// ... BARO modes
				if (key == "XMLVAR_Baro1_Mode" && val == "3") val = "2";
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
							var value = parseFloat(val);
							if ($(this).data("forceinteger")) {
								value = Math.round(value);
							}
							if ((value < 0) && $(this).data("negativeplaceholder")) {
								$(this).text($(this).data("negativeplaceholder"));
							} else {
								var str;
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

	var updateOffsets = function(data) {
		$.each(data, function(key, val) {
			if (offsets.hasOwnProperty(key)) {
				switch (offsets[key].type) {
					case "status_indicator":
						$(".offset_status_indicator[data-offsetaddress=\'" + key + "\']").removeClass("ui-state-active");
						$(".offset_status_indicator[data-offsetaddress=\'" + key + "\'][data-highlightvalue='" + val + "']").addClass("ui-state-active");
						break;
					case "value_indicator":
						$(".offset_value_indicator[data-offsetaddress=\'" + key + "\']").each(function() {
							var str = val;
							if ($(this).data("displayfactor")) {
								str = Math.round(str * parseFloat($(this).data("displayfactor")));
							}
							if ($(this).data("padzeros")) {
								str = str.toString().padStart($(this).data("padzeros"), "0")
							}
							$(this).text(str);
							$(this).data("lastvalue", str);
						});
						updateBaro(); // some hardcoded necessity
						break;
				}
			}
		});
	};

	// Baro behavior is special and needs to be hardcoded
	var updateBaro = function() {
		if ($("#button_baro_mode_std").hasClass("ui-state-active")) {
			$(".qnh_indicator").text("Std");
		} else {
			$(".qnh_indicator").text($(".qnh_indicator").data("lastvalue"));
		}
	}

	var consumeScratchpad = function() {
		var result = $("#scratchpad").text();
		$("#scratchpad").text("");

		if (result == "") return -1; // will just fail silently

		result = parseInt(result);
		if (isNaN(result)) {
			alert("Invalid scratchpad content.");
			return -1;
		}

		return result;
	}

	var padZeros = function(str, count) {
		// Dragon: There is a reason we work so clumsily with strings here. Do not refactor to numbers.
		var negative = false;
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
		if (!offsets.hasOwnProperty($(this).data("offsetaddress".toString()))) {
			offsets[$(this).data("offsetaddress").toString()] = {
				type: "status_indicator",
				offsetaddress: parseInt($(this).data("offsetaddress")),
				offsettype: $(this).data("offsettype"),
				offsetsize: parseInt($(this).data("offsetsize"))
			};
		}
	});
	$(".offset_value_indicator").each(function() {
		if (!offsets.hasOwnProperty($(this).data("offsetaddress".toString()))) {
			offsets[$(this).data("offsetaddress").toString()] = {
				type: "value_indicator",
				offsetaddress: parseInt($(this).data("offsetaddress")),
				offsettype: $(this).data("offsettype"),
				offsetsize: parseInt($(this).data("offsetsize"))
			};
		}
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
		var value = consumeScratchpad();
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
		var v;
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
		var cmd = $(this).data("calculatorcommand");
		if ($(this).data("calculatorisboolsetter")) {
			cmd = ($(this).hasClass("ui-state-active") ? "0 " : "1 ") +  cmd;
		}
		socket.send(JSON.stringify({
			command: "vars.calc",
			name: "calc",
			code: cmd
		}));
	});

	$(".scratchpad_offset_target").click(function() {
		if (socket == null) return;
		var value = consumeScratchpad();
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

	$("#shieldButtons button").click(function() {
		var d = $("#" + $(this).data("targetshield"));
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
				$("#shieldButtons button[data-targetshield='" + $(this).attr("id") + "']").removeClass("ui-state-active");
				updateShieldConfig();
			},
			beforeClose: function() {
				var p = $(this).dialog("widget").position();
				$(this).data("lastPosition", { left: p.left, top: p.top }); // This position "save" will not survive in the URL, but in the current window. This is by design.
			},
			open: function() {
				$("#shieldButtons button[data-targetshield='" + $(this).attr("id") + "']").addClass("ui-state-active");
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

	var config = readHash();
	if (config["socketurl"]) {
		$("#socketURL").val(config["socketurl"]);
	} else {
		$("#socketURL").val("ws://"  + window.location.host + ":2048/fsuipc/"); // best guess
	}
	if (config["autoconnect"]) {
		$("#autoconnectField input").prop("checked", true);
		initializeSocket();
	}

});