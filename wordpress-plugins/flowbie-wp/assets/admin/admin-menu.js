/**
 * Flowbie WP — accordion submenu inline in #adminmenu (click to expand; no popout panel).
 */
(function () {
	'use strict';

	var config = window.flowbieWpAdminMenu || {};
	var parentSlug = config.parentSlug || 'flowbie-wp';
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

	function isFlowbieAdminHref(href) {
		var slug = getPageSlugFromHref(href);
		return slug !== '' && slug.indexOf('flowbie-wp') === 0;
	}

	function findTopLevelLinkForSlug(slug) {
		if (!menuSubmenu || !slug) {
			return null;
		}

		var links = menuSubmenu.querySelectorAll(':scope > li:not(.flowbie-wp-menu-group-li) > a');
		var i;

		for (i = 0; i < links.length; i++) {
			if (isExactPageSlug(links[i].getAttribute('href') || '', slug)) {
				return links[i];
			}
		}

		return null;
	}

	function isFlowbiePageActive() {
		return menuRoot && menuRoot.classList.contains('wp-has-current-submenu');
	}

	function setFlowbieMenuOpen(open) {
		if (!menuRoot) {
			return;
		}
		menuRoot.classList.toggle('flowbie-wp-menu--open', open);
		menuRoot.classList.toggle('wp-menu-open', open);
		menuRoot.classList.toggle('opensub', open);
	}

	function getGroupIdFromLi(groupLi) {
		return groupLi.getAttribute('data-flowbie-group') || '';
	}

	function collapseAllGroups(exceptLi) {
		if (!menuSubmenu) {
			return;
		}

		menuSubmenu.querySelectorAll('.flowbie-wp-menu-group-li--expanded').forEach(function (li) {
			if (li === exceptLi) {
				return;
			}
			setGroupExpanded(li, false);
		});
	}

	function setGroupExpanded(groupLi, expanded) {
		var link = groupLi.querySelector(':scope > a');
		var nested = groupLi.querySelector(':scope > .flowbie-wp-menu-nested');

		groupLi.classList.toggle('flowbie-wp-menu-group-li--expanded', expanded);

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
		if (!isFlowbiePageActive() && !menuRoot.classList.contains('flowbie-wp-menu--open')) {
			setFlowbieMenuOpen(true);
		}

		var willExpand = !groupLi.classList.contains('flowbie-wp-menu-group-li--expanded');
		collapseAllGroups(willExpand ? groupLi : null);
		setGroupExpanded(groupLi, willExpand);
	}

	function openGroupById(groupId, exclusive) {
		if (!menuSubmenu || !groupId) {
			return;
		}

		var groupLi = menuSubmenu.querySelector(
			'.flowbie-wp-menu-group-li[data-flowbie-group="' + groupId + '"]'
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
			if (isFlowbiePageActive()) {
				setFlowbieMenuOpen(true);
				return;
			}

			if (!menuRoot.classList.contains('flowbie-wp-menu--open')) {
				event.preventDefault();
				event.stopPropagation();
				setFlowbieMenuOpen(true);
				return;
			}

			setFlowbieMenuOpen(false);
		});
	}

	function labelDashboardLink(link) {
		var itemSpan = link.querySelector('.flowbie-wp-menu-item');
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

		li.classList.add('flowbie-wp-menu-dashboard-li');
		li.style.display = '';
		li.classList.remove('flowbie-wp-menu-item-li--relocated');
		labelDashboardLink(link);
	}

	function isDashboardSlug(slug) {
		return slug === parentSlug;
	}

	function ensureNestedList(groupLi) {
		var nested = groupLi.querySelector(':scope > .flowbie-wp-menu-nested');

		if (!nested) {
			nested = document.createElement('ul');
			nested.className = 'flowbie-wp-menu-nested';
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

		li.classList.add('flowbie-wp-menu-item-li', 'flowbie-wp-menu-item-li--nested');
		li.appendChild(link);
		return li;
	}

	function hideOrphanTopLevelPageRows() {
		if (!menuSubmenu) {
			return;
		}

		menuSubmenu.querySelectorAll(':scope > li').forEach(function (li) {
			if (
				li.classList.contains('flowbie-wp-menu-group-li') ||
				li.classList.contains('flowbie-wp-menu-dashboard-li')
			) {
				return;
			}

			var link = li.querySelector(':scope > a');
			if (!link) {
				return;
			}

			var href = link.getAttribute('href') || '';
			if (href.indexOf('flowbie-wp-group-') !== -1) {
				return;
			}

			if (!isFlowbieAdminHref(href) && !li.querySelector('.flowbie-wp-menu-item')) {
				return;
			}

			if (isExactPageSlug(href, parentSlug)) {
				return;
			}

			li.classList.add('flowbie-wp-menu-item-li--relocated');
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
					'.flowbie-wp-menu-group-li[data-flowbie-group="' + group.id + '"]'
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
			if (topLi.classList.contains('flowbie-wp-menu-group-li')) {
				activeGroupLi = topLi;
				nestedUl = ensureNestedList(activeGroupLi);
				return;
			}

			link = topLi.querySelector(':scope > a');
			var href = link ? link.getAttribute('href') || '' : '';
			var isPageLink =
				topLi.querySelector('.flowbie-wp-menu-item') ||
				(href.indexOf('page=flowbie-wp') !== -1 && href.indexOf('flowbie-wp-group-') === -1);

			if (!activeGroupLi || !nestedUl || !isPageLink) {
				return;
			}

			if (isExactPageSlug(href, parentSlug)) {
				return;
			}

			topLi.classList.add('flowbie-wp-menu-item-li', 'flowbie-wp-menu-item-li--nested');
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
			var firstGroup = menuSubmenu.querySelector('.flowbie-wp-menu-group-li');
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

		var legacyFlyout = document.getElementById('flowbie-wp-menu-flyout');
		if (legacyFlyout) {
			legacyFlyout.remove();
		}

		var legacyWrap = menuRoot.querySelector('.flowbie-wp-menu-submenu-wrap');
		if (legacyWrap && legacyWrap.contains(menuSubmenu)) {
			legacyWrap.parentNode.insertBefore(menuSubmenu, legacyWrap);
			legacyWrap.remove();
		}

		menuRoot.classList.add('flowbie-wp-menu--accordion');
		menuRoot.classList.remove(
			'flowbie-wp-menu--flyout',
			'flowbie-wp-menu--pinned',
			'flowbie-wp-menu--section-open',
			'flowbie-wp-menu--collapsed'
		);

		if (isFlowbiePageActive()) {
			setFlowbieMenuOpen(true);
		} else {
			setFlowbieMenuOpen(false);
		}

		menuSubmenu.querySelectorAll(':scope > li').forEach(function (li) {
			var link = li.querySelector(':scope > a');
			if (!link) {
				return;
			}

			var groupSpan = link.querySelector('.flowbie-wp-menu-group');
			if (!groupSpan) {
				return;
			}

			var groupId = groupSpan.getAttribute('data-flowbie-group') || '';

			li.classList.add('flowbie-wp-menu-group-li');
			li.setAttribute('data-flowbie-group', groupId);

			if (pageGroups[currentPage] === groupId) {
				li.classList.add('flowbie-wp-menu-group-li--active');
			}

			link.setAttribute('href', '#');
			link.setAttribute('aria-haspopup', 'true');
			link.setAttribute('aria-expanded', 'false');

			bindGroupRow(li, link);
		});

		bindTopLevelMenu();
		nestGroupItems();

		if (isFlowbiePageActive() || menuRoot.classList.contains('flowbie-wp-menu--open')) {
			expandInitialGroup();
		}
	}

	function initMenu() {
		decorateSubmenu();

		if (!menuSubmenu) {
			return;
		}

		var hasNestedLinks = menuSubmenu.querySelector(
			'.flowbie-wp-menu-group-li .flowbie-wp-menu-nested li'
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
