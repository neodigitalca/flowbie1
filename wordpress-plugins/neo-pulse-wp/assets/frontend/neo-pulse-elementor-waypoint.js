(function () {
	function patch() {
		var fe = window.elementorFrontend;
		if (!fe || typeof fe.waypoint === "function") {
			return;
		}
		fe.waypoint = function (el, cb) {
			if (typeof cb !== "function") {
				return;
			}
			if (el && typeof el.each === "function") {
				el.each(function () {
					cb.call(this);
				});
				return;
			}
			cb.call(el);
		};
	}
	function labelGalleries() {
		var containers = document.querySelectorAll(".elementor-gallery__container");
		for (var i = 0; i < containers.length; i++) {
			containers[i].setAttribute("role", "list");
			var items = containers[i].querySelectorAll(".e-gallery-item");
			for (var j = 0; j < items.length; j++) {
				items[j].setAttribute("role", "listitem");
			}
		}
	}
	function labelLists() {
		var lists = document.querySelectorAll('[role="list"]');
		for (var i = 0; i < lists.length; i++) {
			var kids = lists[i].children;
			for (var j = 0; j < kids.length; j++) {
				var el = kids[j];
				var tag = el.tagName;
				if (tag === "STYLE" || tag === "SCRIPT" || tag === "LINK" || tag === "META") {
					continue;
				}
				if (!el.getAttribute("role")) {
					el.setAttribute("role", "listitem");
				}
			}
		}
	}
	function labelAll() {
		labelGalleries();
		labelLists();
	}
	if (window.jQuery) {
		window.jQuery(window).on("elementor/frontend/init", function () {
			patch();
			labelAll();
		});
	}
	patch();
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", labelAll);
	} else {
		labelAll();
	}
})();
