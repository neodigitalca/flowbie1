/**
 * NEO Pulse WP — accordion submenu inline in #adminmenu (click to expand; no popout panel).
 */
(function () {
	'use strict';

	var config = window.neoPulseWpAdminMenu || {};
	var parentSlug = config.parentSlug || 'neo-pulse-wp';
	var pageGroups = config.pageGroups && typeof config.pageGroups === 'object' ? config.pageGroups : {};
	var currentPage = typeof config.currentPage === 'string' ? config.currentPage : '';
	var menuTree = Array.isArray(config.menuTree) ? config.menuTree : [];
	var dashboardLabel =
		typeof config.dashboardLabel === 'string' && config.dashboardLabel !== ''
			? config.dashboardLabel
			: 'Dashboard';

	var menuRoot = null;
	var menuSubmenu = null;

	function getPageSlugFromHref(href) {
		if (!href) {
			return '';
		}
		var match = href.match(/[?&]page=([^&]+)/);
		return match ? decodeURIComponent(match[1]) : '';
	}

	function isExactPageSlug(href, slug) {
		return getPageSlugFromHref(href) === slug;
	}

	function isNeoPulseAdminHref(href) {
		var slug = getPageSlugFromHref(href);
		return slug !== '' && slug.indexOf('neo-pulse-wp') === 0;
	}

	function findTopLevelLinkForSlug(slug) {
		if (!menuSubmenu || !slug) {
			return null;
		}

		var links = menuSubmenu.querySelectorAll(':scope > li:not(.neo-pulse-wp-menu-group-li) > a');
		var i;

		for (i = 0; i < links.length; i++) {
			if (isExactPageSlug(links[i].getAttribute('href') || '', slug)) {
				return links[i];
			}
		}

		return null;
	}

	function isNeoPulsePageActive() {
		return menuRoot && menuRoot.classList.contains('wp-has-current-submenu');
	}

	function setNeoPulseMenuOpen(open) {
		if (!menuRoot) {
			return;
		}
		menuRoot.classList.toggle('neo-pulse-wp-menu--open', open);
		menuRoot.classList.toggle('wp-menu-open', open);
		menuRoot.classList.toggle('opensub', open);
	}

	function getGroupIdFromLi(groupLi) {
		return groupLi.getAttribute('data-neo-pulse-group') || '';
	}

	function collapseAllGroups(exceptLi) {
		if (!menuSubmenu) {
			return;
		}

		menuSubmenu.querySelectorAll('.neo-pulse-wp-menu-group-li--expanded').forEach(function (li) {
			if (li === exceptLi) {
				return;
			}
			setGroupExpanded(li, false);
		});
	}

	function setGroupExpanded(groupLi, expanded) {
		var link = groupLi.querySelector(':scope > a');
		var nested = groupLi.querySelector(':scope > .neo-pulse-wp-menu-nested');

		groupLi.classList.toggle('neo-pulse-wp-menu-group-li--expanded', expanded);

		if (link) {
			link.setAttribute('aria-expanded', expanded ? 'true' : 'false');
		}

		if (nested) {
			if (expanded) {
				nested.hidden = false;
				nested.removeAttribute('hidden');
				nested.style.display = '';
			} else {
				nested.hidden = true;
			}
		}
	}

	function toggleGroup(groupLi) {
		if (!isNeoPulsePageActive() && !menuRoot.classList.contains('neo-pulse-wp-menu--open')) {
			setNeoPulseMenuOpen(true);
		}

		var willExpand = !groupLi.classList.contains('neo-pulse-wp-menu-group-li--expanded');
		collapseAllGroups(willExpand ? groupLi : null);
		setGroupExpanded(groupLi, willExpand);
	}

	function openGroupById(groupId, exclusive) {
		if (!menuSubmenu || !groupId) {
			return;
		}

		var groupLi = menuSubmenu.querySelector(
			'.neo-pulse-wp-menu-group-li[data-neo-pulse-group="' + groupId + '"]'
		);

		if (!groupLi) {
			return;
		}

		if (exclusive) {
			collapseAllGroups(groupLi);
		}
		setGroupExpanded(groupLi, true);
	}

	function bindGroupRow(groupLi, link) {
		link.addEventListener('click', function (event) {
			event.preventDefault();
			event.stopPropagation();
			toggleGroup(groupLi);
		});

		link.addEventListener('keydown', function (event) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				toggleGroup(groupLi);
			}
		});
	}

	function bindTopLevelMenu() {
		var topLink = menuRoot.querySelector(':scope > a.menu-top');
		if (!topLink) {
			return;
		}

		topLink.addEventListener('click', function (event) {
			if (isNeoPulsePageActive()) {
				setNeoPulseMenuOpen(true);
				return;
			}

			if (!menuRoot.classList.contains('neo-pulse-wp-menu--open')) {
				event.preventDefault();
				event.stopPropagation();
				setNeoPulseMenuOpen(true);
				return;
			}

			setNeoPulseMenuOpen(false);
		});
	}

	function labelDashboardLink(link) {
		var itemSpan = link.querySelector('.neo-pulse-wp-menu-item');
		if (itemSpan) {
			itemSpan.textContent = dashboardLabel;
			return;
		}
		link.textContent = dashboardLabel;
	}

	function ensureDashboardVisible() {
		if (!menuSubmenu) {
			return;
		}

		var link = findTopLevelLinkForSlug(parentSlug);
		var li;

		if (!link) {
			return;
		}

		li = link.closest('li');
		if (!li) {
			return;
		}

		li.classList.add('neo-pulse-wp-menu-dashboard-li');
		li.style.display = '';
		li.classList.remove('neo-pulse-wp-menu-item-li--relocated');
		labelDashboardLink(link);
	}

	function isDashboardSlug(slug) {
		return slug === parentSlug;
	}

	function ensureNestedList(groupLi) {
		var nested = groupLi.querySelector(':scope > .neo-pulse-wp-menu-nested');

		if (!nested) {
			nested = document.createElement('ul');
			nested.className = 'neo-pulse-wp-menu-nested';
			nested.hidden = true;
			groupLi.appendChild(nested);
		}

		return nested;
	}

	function buildNestedItem(item) {
		var slug = item.slug || '';
		var li = document.createElement('li');
		var link = document.createElement('a');
		var existing = findTopLevelLinkForSlug(slug);

		link.href = item.href || 'admin.php?page=' + slug;
		link.textContent = item.label || slug;

		if (existing && existing.closest('li') && existing.closest('li').classList.contains('current')) {
			li.classList.add('current');
			link.setAttribute('aria-current', 'page');
		} else if (item.isCurrent) {
			li.classList.add('current');
			link.setAttribute('aria-current', 'page');
		}

		li.classList.add('neo-pulse-wp-menu-item-li', 'neo-pulse-wp-menu-item-li--nested');
		li.appendChild(link);
		return li;
	}

	function hideOrphanTopLevelPageRows() {
		if (!menuSubmenu) {
			return;
		}

		menuSubmenu.querySelectorAll(':scope > li').forEach(function (li) {
			if (
				li.classList.contains('neo-pulse-wp-menu-group-li') ||
				li.classList.contains('neo-pulse-wp-menu-dashboard-li')
			) {
				return;
			}

			var link = li.querySelector(':scope > a');
			if (!link) {
				return;
			}

			var href = link.getAttribute('href') || '';
			if (href.indexOf('neo-pulse-wp-group-') !== -1) {
				return;
			}

			if (!isNeoPulseAdminHref(href) && !li.querySelector('.neo-pulse-wp-menu-item')) {
				return;
			}

			if (isExactPageSlug(href, parentSlug)) {
				return;
			}

			li.classList.add('neo-pulse-wp-menu-item-li--relocated');
			li.style.display = 'none';
		});
	}

	function nestGroupItems() {
		if (!menuSubmenu) {
			return;
		}

		var group;
		var groupLi;
		var nested;
		var items;
		var item;
		var g;
		var t;

		if (menuTree.length) {
			for (g = 0; g < menuTree.length; g++) {
				group = menuTree[g];
				if (!group || !group.id) {
					continue;
				}

				groupLi = menuSubmenu.querySelector(
					'.neo-pulse-wp-menu-group-li[data-neo-pulse-group="' + group.id + '"]'
				);
				if (!groupLi) {
					continue;
				}

				nested = ensureNestedList(groupLi);
				nested.innerHTML = '';
				items = Array.isArray(group.items) ? group.items : [];

				for (t = 0; t < items.length; t++) {
					item = items[t];
					if (!item || !item.slug || isDashboardSlug(item.slug)) {
						continue;
					}
					nested.appendChild(buildNestedItem(item));
				}
			}

			hideOrphanTopLevelPageRows();
			ensureDashboardVisible();
			return;
		}

		var topItems = Array.prototype.slice.call(menuSubmenu.querySelectorAll(':scope > li'));
		var activeGroupLi = null;
		var nestedUl = null;

		topItems.forEach(function (topLi) {
			if (topLi.classList.contains('neo-pulse-wp-menu-group-li')) {
				activeGroupLi = topLi;
				nestedUl = ensureNestedList(activeGroupLi);
				return;
			}

			link = topLi.querySelector(':scope > a');
			var href = link ? link.getAttribute('href') || '' : '';
			var isPageLink =
				topLi.querySelector('.neo-pulse-wp-menu-item') ||
				(href.indexOf('page=neo-pulse-wp') !== -1 && href.indexOf('neo-pulse-wp-group-') === -1);

			if (!activeGroupLi || !nestedUl || !isPageLink) {
				return;
			}

			if (isExactPageSlug(href, parentSlug)) {
				return;
			}

			topLi.classList.add('neo-pulse-wp-menu-item-li', 'neo-pulse-wp-menu-item-li--nested');
			nestedUl.appendChild(topLi);
		});

		hideOrphanTopLevelPageRows();
		ensureDashboardVisible();
	}

	function expandInitialGroup() {
		if (!menuSubmenu) {
			return;
		}

		var groupId = pageGroups[currentPage];
		if (groupId) {
			openGroupById(groupId, true);
			return;
		}

		if (currentPage === parentSlug) {
			var firstGroup = menuSubmenu.querySelector('.neo-pulse-wp-menu-group-li');
			if (firstGroup) {
				openGroupById(getGroupIdFromLi(firstGroup), true);
			}
		}
	}

	function decorateSubmenu() {
		menuRoot = document.querySelector('#adminmenu .toplevel_page_' + parentSlug);
		menuSubmenu = menuRoot ? menuRoot.querySelector('ul.wp-submenu') : null;

		if (!menuSubmenu) {
			return;
		}

		var legacyFlyout = document.getElementById('neo-pulse-wp-menu-flyout');
		if (legacyFlyout) {
			legacyFlyout.remove();
		}

		var legacyWrap = menuRoot.querySelector('.neo-pulse-wp-menu-submenu-wrap');
		if (legacyWrap && legacyWrap.contains(menuSubmenu)) {
			legacyWrap.parentNode.insertBefore(menuSubmenu, legacyWrap);
			legacyWrap.remove();
		}

		menuRoot.classList.add('neo-pulse-wp-menu--accordion');
		menuRoot.classList.remove(
			'neo-pulse-wp-menu--flyout',
			'neo-pulse-wp-menu--pinned',
			'neo-pulse-wp-menu--section-open',
			'neo-pulse-wp-menu--collapsed'
		);

		if (isNeoPulsePageActive()) {
			setNeoPulseMenuOpen(true);
		} else {
			setNeoPulseMenuOpen(false);
		}

		menuSubmenu.querySelectorAll(':scope > li').forEach(function (li) {
			var link = li.querySelector(':scope > a');
			if (!link) {
				return;
			}

			var groupSpan = link.querySelector('.neo-pulse-wp-menu-group');
			if (!groupSpan) {
				return;
			}

			var groupId = groupSpan.getAttribute('data-neo-pulse-group') || '';

			li.classList.add('neo-pulse-wp-menu-group-li');
			li.setAttribute('data-neo-pulse-group', groupId);

			if (pageGroups[currentPage] === groupId) {
				li.classList.add('neo-pulse-wp-menu-group-li--active');
			}

			link.setAttribute('href', '#');
			link.setAttribute('aria-haspopup', 'true');
			link.setAttribute('aria-expanded', 'false');

			bindGroupRow(li, link);
		});

		bindTopLevelMenu();
		nestGroupItems();

		if (isNeoPulsePageActive() || menuRoot.classList.contains('neo-pulse-wp-menu--open')) {
			expandInitialGroup();
		}
	}

	function initMenu() {
		decorateSubmenu();

		if (!menuSubmenu) {
			return;
		}

		var hasNestedLinks = menuSubmenu.querySelector(
			'.neo-pulse-wp-menu-group-li .neo-pulse-wp-menu-nested li'
		);
		if (!hasNestedLinks && menuTree.length) {
			window.setTimeout(decorateSubmenu, 120);
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initMenu);
	} else {
		initMenu();
	}
})();
