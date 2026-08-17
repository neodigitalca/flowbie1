(function ($) {
	'use strict';

	var cfg = window.NeoPulseSeoBlockEditor || {};
	var previewState = null;

	function rest(path, options) {
		options = options || {};
		return fetch((cfg.restRoot || '') + path, {
			method: options.method || 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': cfg.nonce || ''
			},
			credentials: 'same-origin',
			body: options.body ? JSON.stringify(options.body) : undefined
		}).then(function (res) {
			return res.json().then(function (json) {
				if (!res.ok) throw new Error((json && json.message) || cfg.i18n.error);
				return json;
			});
		});
	}

	function getEditorContext() {
		if (!window.elementor || !elementor.getPanelView) return null;
		var page = elementor.settings && elementor.settings.page ? elementor.settings.page.model : null;
		var postId = page ? parseInt(page.get('post_id') || page.get('id') || '0', 10) : 0;
		var current = elementor.getPanelView().getCurrentPageView();
		var model = current && current.model ? current.model : null;
		if (!model) return null;
		var settings = model.get('settings');
		var elementId = model.get('id');
		return {
			postId: postId,
			elementId: elementId,
			settings: settings,
			model: model
		};
	}

	function settingsToPayload(settings) {
		var slots = [];
		var raw = settings.get ? settings.get('content_slots') : (settings.content_slots || []);
		if (raw && raw.models) {
			raw.each(function (item) {
				slots.push(item.toJSON());
			});
		} else if (Array.isArray(raw)) {
			slots = raw;
		}
		var registryId = settings.get ? settings.get('registry_block_id') : settings.registry_block_id;
		var blockId = settings.get ? settings.get('block_id') : settings.block_id;
		return {
			block_id: parseInt(registryId || blockId || '0', 10),
			focus_keyword: settings.get ? settings.get('focus_keyword') : settings.focus_keyword,
			topic_focus: settings.get ? settings.get('topic_focus') : settings.topic_focus,
			slots: slots
		};
	}

	function buildSettingsPatch(block) {
		var widgetSettings = block.widget_settings || {};
		var slots = widgetSettings.content_slots || (block.slots || []).map(mapSlotToRepeater);
		var layoutJson = widgetSettings.layout_config_json || (block.layout_config ? JSON.stringify(block.layout_config) : '');
		return {
			registry_block_id: String(widgetSettings.registry_block_id || block.id || ''),
			block_id: String(widgetSettings.block_id || block.id || ''),
			focus_keyword: widgetSettings.focus_keyword || block.focus_keyword || '',
			topic_focus: widgetSettings.topic_focus || block.topic_focus || '',
			content_slots: slots,
			layout_config_json: layoutJson
		};
	}

	function updateLinkedSummary(panel, block) {
		if (!panel || !panel.$el || !block) {
			return;
		}
		var html = '<div class="neo-pulse-seo-block-linked-summary">' +
			'<strong>#' + esc(String(block.id || '')) + '</strong> · ' + esc(block.title || '—') + '<br>' +
			esc(cfg.i18n.focusKeyword || 'Focus keyword') + ': ' + esc(block.focus_keyword || '—') + '<br>' +
			esc(cfg.i18n.h2 || 'H2') + ': ' + esc(block.h2 || '—') + '<br>' +
			esc(cfg.i18n.slots || 'Slots') + ': ' + esc(block.slot_summary || '—') +
			'</div>';
		panel.$el.find('.neo-pulse-seo-block-linked-summary').html(html);
	}

	function getElementContainer(model) {
		if (!model) {
			return null;
		}
		if (model.getContainer) {
			return model.getContainer();
		}
		if (model.getEditModel && model.getEditModel().getContainer) {
			return model.getEditModel().getContainer();
		}
		if (window.elementor && elementor.getContainer && model.get) {
			return elementor.getContainer(model.get('id'));
		}
		return null;
	}

	function elementorSetSettingsCommand() {
		if (!window.$e || !$e.commands || typeof $e.commands.is !== 'function') {
			return '';
		}
		var candidates = [
			'document/elements/set-settings',
			'panel/editor/set-settings'
		];
		for (var i = 0; i < candidates.length; i++) {
			if ($e.commands.is(candidates[i])) {
				return candidates[i];
			}
		}
		return '';
	}

	function applyBlockToSettings(model, block, panel) {
		if (!model || !block) {
			return Promise.resolve();
		}
		var patch = buildSettingsPatch(block);
		var container = getElementContainer(model);
		var command = elementorSetSettingsCommand();

		if (command && container) {
			return $e.run(command, {
				container: container,
				settings: patch,
				options: { external: true }
			}).then(function () {
				if (panel) {
					updateLinkedSummary(panel, block);
				}
				if (window.elementor && elementor.saver) {
					elementor.saver.setFlagEditorChange(true);
				}
			}).catch(function () {
				applyBlockToSettingsFallback(model, block, panel, patch);
			});
		}

		applyBlockToSettingsFallback(model, block, panel, patch);
		return Promise.resolve();
	}

	function applyBlockToSettingsFallback(model, block, panel, patch) {
		var settings = model.get('settings');
		if (!settings || !settings.set) {
			return;
		}

		settings.set('registry_block_id', patch.registry_block_id);
		settings.set('block_id', patch.block_id);
		settings.set('focus_keyword', patch.focus_keyword);
		settings.set('topic_focus', patch.topic_focus);
		settings.set('content_slots', patch.content_slots);
		settings.set('layout_config_json', patch.layout_config_json);

		if (panel) {
			updateLinkedSummary(panel, block);
		}
		if (window.elementor && elementor.saver) {
			elementor.saver.setFlagEditorChange(true);
		}
		if (model.renderOnChange) {
			model.renderOnChange();
		}
	}

	function loadLinkedBlock(model, panel, id) {
		if (id < 1) {
			return Promise.resolve();
		}
		return rest('seo-blocks/' + id).then(function (data) {
			return applyBlockToSettings(model, data.block, panel);
		});
	}

	function refreshRegistryChoices(panel) {
		return rest('seo-blocks/choices').then(function (data) {
			var choices = data.choices || { '': '— Select Agent Hub block —' };
			var controlModel = panel.getControlModel && panel.getControlModel('registry_block_id');
			if (controlModel) {
				controlModel.set('options', choices);
			}
			var controlView = panel.getControlView && panel.getControlView('registry_block_id');
			if (controlView && controlView.render) {
				controlView.render();
			}
		}).catch(function () {
			/* keep static options from PHP */
		});
	}

	function ensureLinkedBlockLoaded(model, panel) {
		var settings = model.get('settings');
		if (!settings || !settings.get) {
			return;
		}
		var id = parseInt(settings.get('registry_block_id') || settings.get('block_id') || '0', 10);
		if (id < 1) {
			return;
		}
		loadLinkedBlock(model, panel, id).catch(function () {
			/* ignore */
		});
	}

	function bindRegistrySelector(model, panel) {
		var settings = model.get('settings');
		if (!settings || settings.neoPulseRegistryBound) {
			return;
		}
		settings.neoPulseRegistryBound = true;

		settings.on('change:registry_block_id', function () {
			var id = parseInt(settings.get('registry_block_id') || '0', 10);
			if (id < 1) {
				settings.set('block_id', '');
				if (panel && panel.$el) {
					panel.$el.find('.neo-pulse-seo-block-linked-summary').text(cfg.i18n.selectBlock || 'Select a block from the Agent Hub table first.');
				}
				return;
			}
			loadLinkedBlock(model, panel, id).catch(function (err) {
				window.alert(err.message || cfg.i18n.error);
			});
		});
	}

	function injectWands() {
		if (!window.elementor || !elementor.hooks) return;
		elementor.hooks.addFilter('panel/elements/regionViews', function (panel) {
			if (panel.neoPulseSeoWandsBound) return panel;
			panel.neoPulseSeoWandsBound = true;
			var orig = panel.footer && panel.footer.currentView;
			return panel;
		});

		elementor.hooks.addAction('panel/open_editor/widget/neo-pulse_seo_section', function panelOpen(panel, model) {
			setTimeout(function () {
				refreshRegistryChoices(panel);
				mountWandControls(panel, model);
				bindRegistrySelector(model, panel);
				ensureLinkedBlockLoaded(model, panel);
			}, 120);
		});
	}

	function mountWandControls(panel, model) {
		var $footer = panel.$el.find('.elementor-panel-footer');
		if (!$footer.length || $footer.find('.neo-pulse-seo-block-wands').length) return;
		var html = '<div class="neo-pulse-seo-block-wands">' +
			'<button type="button" class="neo-pulse-seo-block-wand neo-pulse-seo-block-wand--black" data-mode="full" title="' + esc(cfg.i18n.optimizeFull) + '">✦</button>' +
			'<button type="button" class="neo-pulse-seo-block-wand neo-pulse-seo-block-wand--white" data-mode="intent" title="' + esc(cfg.i18n.optimizeIntent) + '">✦</button>' +
			'</div>';
		$footer.prepend(html);
		$footer.find('.neo-pulse-seo-block-wand').on('click', function () {
			runPreview(model, $(this).data('mode'));
		});
	}

	function esc(str) {
		return String(str || '').replace(/"/g, '&quot;');
	}

	function runPreview(model, mode) {
		var ctx = getEditorContext();
		if (!ctx) return;
		var payload = settingsToPayload(model.get('settings'));
		if (!payload.topic_focus) {
			window.alert(cfg.i18n.error);
			return;
		}
		rest('ai/seo-block/preview', {
			method: 'POST',
			body: {
				post_id: ctx.postId,
				element_id: ctx.elementId,
				block_id: payload.block_id,
				mode: mode,
				topic_focus: payload.topic_focus,
				focus_keyword: payload.focus_keyword,
				slots: payload.slots
			}
		}).then(function (data) {
			previewState = {
				model: model,
				ctx: ctx,
				data: data
			};
			showModal(data);
		}).catch(function (err) {
			window.alert(err.message || cfg.i18n.error);
		});
	}

	function showModal(data) {
		closeModal();
		var before = JSON.stringify(data.original_slots || [], null, 2);
		var after = JSON.stringify(data.preview_slots || [], null, 2);
		var $modal = $('<div class="neo-pulse-seo-block-modal"><div class="neo-pulse-seo-block-modal__panel">' +
			'<h3>' + esc(cfg.i18n.previewTitle) + '</h3>' +
			'<p><strong>Before</strong></p><pre></pre>' +
			'<p><strong>After</strong></p><pre></pre>' +
			'<div class="neo-pulse-seo-block-modal__actions">' +
			'<button type="button" class="button button-primary neo-pulse-seo-block-apply">' + esc(cfg.i18n.apply) + '</button>' +
			'<button type="button" class="button neo-pulse-seo-block-cancel">' + esc(cfg.i18n.cancel) + '</button>' +
			'</div></div></div>');
		$modal.find('pre').eq(0).text(before);
		$modal.find('pre').eq(1).text(after);
		$('body').append($modal);
		$modal.on('click', '.neo-pulse-seo-block-cancel', closeModal);
		$modal.on('click', '.neo-pulse-seo-block-apply', applyPreview);
	}

	function closeModal() {
		$('.neo-pulse-seo-block-modal').remove();
	}

	function applyPreview() {
		if (!previewState) return;
		var payload = settingsToPayload(previewState.model.get('settings'));
		rest('ai/seo-block/apply', {
			method: 'POST',
			body: {
				post_id: previewState.ctx.postId,
				element_id: previewState.ctx.elementId,
				block_id: payload.block_id,
				preview_slots: previewState.data.preview_slots || [],
				topic_focus: previewState.data.topic_focus || payload.topic_focus,
				focus_keyword: previewState.data.focus_keyword || payload.focus_keyword
			}
		}).then(function () {
			var slots = previewState.data.preview_slots || [];
			var settings = previewState.model.get('settings');
			if (settings && settings.set) {
				var repeater = settings.get('content_slots');
				if (repeater && repeater.reset) {
					repeater.reset([]);
				}
				slots.forEach(function (slot, index) {
					var row = mapSlotToRepeater(slot);
					if (repeater && repeater.add) {
						repeater.add(row, { index: index });
					}
				});
				if (previewState.data.topic_focus) settings.set('topic_focus', previewState.data.topic_focus);
				if (previewState.data.focus_keyword) settings.set('focus_keyword', previewState.data.focus_keyword);
			}
			closeModal();
			if (window.elementor && elementor.saver) {
				elementor.saver.setFlagEditorChange(true);
			}
		}).catch(function (err) {
			window.alert(err.message || cfg.i18n.error);
		});
	}

	function mapSlotToRepeater(slot) {
		var row = { type: slot.type || 'paragraph' };
		switch (row.type) {
			case 'h2':
				row.text = slot.text || '';
				break;
			case 'paragraph':
				row.html = slot.html || '';
				break;
			case 'cta':
				row.label = slot.label || '';
				row.url = { url: slot.url || '' };
				row.style = slot.style || 'primary';
				break;
			case 'image':
				row.attachment_id = slot.attachment_id ? { id: slot.attachment_id, url: '' } : {};
				row.alt = slot.alt || '';
				break;
			case 'list':
				row.list_style = slot.style || 'bullet';
				row.items = (slot.items || []).join('\n');
				break;
		}
		return row;
	}

	$(window).on('elementor:init', function () {
		injectWands();
	});
})(jQuery);
