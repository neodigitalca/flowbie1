(function ($) {
	'use strict';

	var cfg = window.neoPulseFormsBuilder || {};
	var fieldTypes = cfg.fieldTypes || {};
	var fieldGroups = cfg.fieldGroups || {};
	var strings = cfg.strings || {};

	var NAME_SUBFIELDS = ['prefix', 'first', 'last', 'suffix'];
	var ADDRESS_SUBFIELDS = ['street', 'street2', 'city', 'state', 'zip', 'country'];

	function parseInitial() {
		var el = document.getElementById('neo-pulse-form-initial-data');
		if (!el || !el.textContent) {
			return { ID: 0, key: 'form_' + Date.now(), title: '', active: true, settings: {}, fields: [] };
		}
		try {
			return JSON.parse(el.textContent);
		} catch (e) {
			return { ID: 0, key: 'form_' + Date.now(), title: '', active: true, settings: {}, fields: [] };
		}
	}

	function defaultField(type) {
		var label = fieldTypes[type] || 'Field';
		var field = {
			id: 'fld_' + Math.random().toString(36).slice(2, 10),
			type: type,
			label: label,
			name: 'field_' + Math.random().toString(36).slice(2, 8),
			required: type === 'consent',
			placeholder: '',
			default_value: '',
			choices: [
				{ label: 'Option 1', value: 'option_1' },
				{ label: 'Option 2', value: 'option_2' }
			],
			consent_label: 'I agree to the privacy policy.',
			allowed_mime_types: 'pdf,doc,docx,jpg,jpeg,png,gif',
			max_file_size_mb: 5,
			css_class: '',
			html_content: '',
			section_description: '',
			name_subfields: { prefix: false, first: true, last: true, suffix: false },
			address_subfields: { street: true, street2: true, city: true, state: true, zip: true, country: false }
		};
		if (type === 'name') {
			field.label = 'Name';
			field.name = 'name';
		}
		if (type === 'address') {
			field.label = 'Address';
			field.name = 'address';
		}
		if (type === 'section') {
			field.label = 'Section';
		}
		return field;
	}

	function choicesToText(choices) {
		if (!choices || !choices.length) return '';
		return choices
			.map(function (c) {
				return (c.label || '') + '|' + (c.value || '');
			})
			.join('\n');
	}

	function textToChoices(text) {
		return text
			.split('\n')
			.map(function (line) {
				line = line.trim();
				if (!line) return null;
				var parts = line.split('|');
				var lbl = (parts[0] || '').trim();
				var val = (parts[1] || '').trim() || lbl.toLowerCase().replace(/\s+/g, '_');
				return { label: lbl, value: val };
			})
			.filter(Boolean);
	}

	function escAttr(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;');
	}

	function escText(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;');
	}

	function syncFieldFromSettings() {
		var idx = state.selectedIndex;
		if (idx < 0 || !state.fields[idx]) return;
		var $panel = $('#neo-pulse-field-settings-panel');
		var field = state.fields[idx];
		field.label = $panel.find('.neo-pulse-fs-label').val() || '';
		field.name = $panel.find('.neo-pulse-fs-name').val() || field.name;
		field.required = $panel.find('.neo-pulse-fs-required').is(':checked');
		field.placeholder = $panel.find('.neo-pulse-fs-placeholder').val() || '';
		field.default_value = $panel.find('.neo-pulse-fs-default').val() || '';
		field.css_class = $panel.find('.neo-pulse-fs-css').val() || '';
		if ($panel.find('.neo-pulse-fs-choices').length) {
			field.choices = textToChoices($panel.find('.neo-pulse-fs-choices').val());
		}
		if ($panel.find('.neo-pulse-fs-consent').length) {
			field.consent_label = $panel.find('.neo-pulse-fs-consent').val() || '';
		}
		if ($panel.find('.neo-pulse-fs-mimes').length) {
			field.allowed_mime_types = $panel.find('.neo-pulse-fs-mimes').val() || '';
			field.max_file_size_mb = parseInt($panel.find('.neo-pulse-fs-maxmb').val(), 10) || 5;
		}
		if ($panel.find('.neo-pulse-fs-html').length) {
			field.html_content = $panel.find('.neo-pulse-fs-html').val() || '';
		}
		if ($panel.find('.neo-pulse-fs-section-desc').length) {
			field.section_description = $panel.find('.neo-pulse-fs-section-desc').val() || '';
		}
		NAME_SUBFIELDS.forEach(function (key) {
			var $cb = $panel.find('.neo-pulse-fs-name-sub[data-key="' + key + '"]');
			if ($cb.length) {
				field.name_subfields = field.name_subfields || {};
				field.name_subfields[key] = $cb.is(':checked');
			}
		});
		ADDRESS_SUBFIELDS.forEach(function (key) {
			var $cb = $panel.find('.neo-pulse-fs-address-sub[data-key="' + key + '"]');
			if ($cb.length) {
				field.address_subfields = field.address_subfields || {};
				field.address_subfields[key] = $cb.is(':checked');
			}
		});
		renderCanvas();
	}

	function renderFieldSettings(field) {
		var type = field.type || 'text';
		var choiceTypes = ['select', 'checkbox', 'radio'];
		var html =
			'<table class="form-table neo-pulse-wp-forms-builder__settings-table"><tbody>' +
			'<tr><th>Label</th><td><input type="text" class="regular-text neo-pulse-fs-label" value="' +
			escAttr(field.label || '') +
			'" /></td></tr>';

		if (type !== 'html' && type !== 'section') {
			html +=
				'<tr><th>Name</th><td><input type="text" class="regular-text neo-pulse-fs-name" value="' +
				escAttr(field.name || '') +
				'" /></td></tr>';
		}

		if (type !== 'html' && type !== 'section' && type !== 'hidden') {
			html +=
				'<tr><th>Required</th><td><label><input type="checkbox" class="neo-pulse-fs-required"' +
				(field.required ? ' checked' : '') +
				' /> Required</label></td></tr>';
		}

		if (['text', 'textarea', 'email', 'phone', 'number', 'website', 'date', 'time'].indexOf(type) !== -1) {
			html +=
				'<tr><th>Placeholder</th><td><input type="text" class="regular-text neo-pulse-fs-placeholder" value="' +
				escAttr(field.placeholder || '') +
				'" /></td></tr>' +
				'<tr><th>Default</th><td><input type="text" class="regular-text neo-pulse-fs-default" value="' +
				escAttr(field.default_value || '') +
				'" /></td></tr>';
		}

		if (choiceTypes.indexOf(type) !== -1) {
			html +=
				'<tr><th>Choices</th><td><textarea class="large-text neo-pulse-fs-choices" rows="4">' +
				escText(choicesToText(field.choices)) +
				'</textarea><p class="description">One per line: Label|value</p></td></tr>';
		}
		if (type === 'consent') {
			html +=
				'<tr><th>Consent text</th><td><textarea class="large-text neo-pulse-fs-consent" rows="2">' +
				escText(field.consent_label || '') +
				'</textarea></td></tr>';
		}
		if (type === 'file') {
			html +=
				'<tr><th>Allowed types</th><td><input type="text" class="regular-text neo-pulse-fs-mimes" value="' +
				escAttr(field.allowed_mime_types || '') +
				'" /></td></tr>' +
				'<tr><th>Max size (MB)</th><td><input type="number" class="small-text neo-pulse-fs-maxmb" min="1" max="50" value="' +
				escAttr(String(field.max_file_size_mb || 5)) +
				'" /></td></tr>';
		}
		if (type === 'html') {
			html +=
				'<tr><th>HTML</th><td><textarea class="large-text neo-pulse-fs-html" rows="6">' +
				escText(field.html_content || '') +
				'</textarea></td></tr>';
		}
		if (type === 'section') {
			html +=
				'<tr><th>Description</th><td><textarea class="large-text neo-pulse-fs-section-desc" rows="2">' +
				escText(field.section_description || '') +
				'</textarea></td></tr>';
		}
		if (type === 'name') {
			html += '<tr><th>Subfields</th><td>';
			NAME_SUBFIELDS.forEach(function (key) {
				var checked = field.name_subfields && field.name_subfields[key];
				html +=
					'<label style="display:block;margin:4px 0;"><input type="checkbox" class="neo-pulse-fs-name-sub" data-key="' +
					key +
					'"' +
					(checked ? ' checked' : '') +
					' /> ' +
					key +
					'</label>';
			});
			html += '</td></tr>';
		}
		if (type === 'address') {
			html += '<tr><th>Subfields</th><td>';
			ADDRESS_SUBFIELDS.forEach(function (key) {
				var checked = !field.address_subfields || field.address_subfields[key] !== false;
				if (field.address_subfields && field.address_subfields[key] === false) {
					checked = false;
				}
				html +=
					'<label style="display:block;margin:4px 0;"><input type="checkbox" class="neo-pulse-fs-address-sub" data-key="' +
					key +
					'"' +
					(checked ? ' checked' : '') +
					' /> ' +
					key +
					'</label>';
			});
			html += '</td></tr>';
		}

		html +=
			'<tr><th>CSS class</th><td><input type="text" class="regular-text neo-pulse-fs-css" value="' +
			escAttr(field.css_class || '') +
			'" /></td></tr>' +
			'</tbody></table>' +
			'<p><button type="button" class="button button-link-delete neo-pulse-fs-remove">' +
			(strings.removeField || 'Remove') +
			' field</button></p>';

		return html;
	}

	function renderFieldCard(field, index) {
		var type = field.type || 'text';
		var selected = state.selectedIndex === index ? ' is-selected' : '';
		var preview = field.label || fieldTypes[type] || type;
		if (type === 'html') {
			preview = 'HTML';
		}

		return (
			'<div class="neo-pulse-wp-forms-field-card' +
			selected +
			'" data-index="' +
			index +
			'">' +
			'<span class="neo-pulse-field-drag-handle" title="' +
			escAttr(strings.dragHandle || 'Drag') +
			'">☰</span>' +
			'<div class="neo-pulse-wp-forms-field-card__body">' +
			'<span class="neo-pulse-wp-forms-field-card__type">' +
			escText(fieldTypes[type] || type) +
			'</span>' +
			'<strong class="neo-pulse-wp-forms-field-card__label">' +
			escText(preview) +
			'</strong>' +
			(field.required && type !== 'html' && type !== 'section'
				? '<span class="neo-pulse-wp-forms-field-card__req">*</span>'
				: '') +
			'</div>' +
			'<button type="button" class="button-link neo-pulse-field-remove" aria-label="' +
			escAttr(strings.removeField || 'Remove') +
			'">&times;</button>' +
			'</div>'
		);
	}

	function renderCanvas() {
		var $list = $('#neo-pulse-form-fields-list');
		$list.empty();
		state.fields.forEach(function (field, i) {
			$list.append(renderFieldCard(field, i));
		});
		$('#neo-pulse-form-fields-empty').toggle(state.fields.length === 0);
		if (state.selectedIndex >= 0 && state.fields[state.selectedIndex]) {
			$('#neo-pulse-field-settings-panel').html(renderFieldSettings(state.fields[state.selectedIndex]));
		}
	}

	function selectField(index) {
		syncFieldFromSettings();
		state.selectedIndex = index;
		renderCanvas();
		$('.neo-pulse-wp-forms-builder__tab[data-tab="field-settings"]').trigger('click');
	}

	function addField(type) {
		syncFieldFromSettings();
		state.fields.push(defaultField(type));
		state.selectedIndex = state.fields.length - 1;
		renderCanvas();
	}

	function initSortable() {
		var $list = $('#neo-pulse-form-fields-list');
		if (!$.fn.sortable) {
			return;
		}
		if ($list.hasClass('ui-sortable')) {
			$list.sortable('destroy');
		}
		$list.sortable({
			handle: '.neo-pulse-field-drag-handle',
			placeholder: 'neo-pulse-wp-forms-field-card neo-pulse-wp-forms-field-card--placeholder',
			forcePlaceholderSize: true,
			update: function () {
				var ordered = [];
				$list.find('.neo-pulse-wp-forms-field-card').each(function () {
					var idx = $(this).data('index');
					if (state.fields[idx]) {
						ordered.push(state.fields[idx]);
					}
				});
				state.fields = ordered;
				renderCanvas();
			}
		});
	}

	function switchTab(tab) {
		$('.neo-pulse-wp-forms-builder__tab').removeClass('is-active');
		$('.neo-pulse-wp-forms-builder__tab[data-tab="' + tab + '"]').addClass('is-active');
		$('.neo-pulse-wp-forms-builder__tab-panel').removeClass('is-active');
		$('.neo-pulse-wp-forms-builder__tab-panel[data-panel="' + tab + '"]').addClass('is-active');
	}

	var state = parseInitial();
	state.selectedIndex = state.fields.length > 0 ? 0 : -1;

	$(function () {
		renderCanvas();
		initSortable();

		$('.neo-pulse-wp-forms-builder__tab').on('click', function () {
			syncFieldFromSettings();
			switchTab($(this).data('tab'));
		});

		$(document).on('click', '.neo-pulse-field-palette-item', function () {
			addField($(this).data('type') || 'text');
		});

		$('#neo-pulse-form-fields-list').on('click', '.neo-pulse-wp-forms-field-card', function (e) {
			if ($(e.target).closest('.neo-pulse-field-remove').length) {
				return;
			}
			selectField($(this).data('index'));
		});

		$('#neo-pulse-form-fields-list').on('click', '.neo-pulse-field-remove', function (e) {
			e.stopPropagation();
			syncFieldFromSettings();
			var idx = $(this).closest('.neo-pulse-wp-forms-field-card').data('index');
			state.fields.splice(idx, 1);
			if (state.selectedIndex >= state.fields.length) {
				state.selectedIndex = state.fields.length - 1;
			}
			renderCanvas();
			if (state.selectedIndex < 0) {
				$('#neo-pulse-field-settings-panel').html(
					'<p class="description">' + escText(strings.selectField || '') + '</p>'
				);
			}
		});

		$(document).on('input change', '#neo-pulse-field-settings-panel input, #neo-pulse-field-settings-panel textarea', function () {
			syncFieldFromSettings();
		});

		$(document).on('click', '.neo-pulse-fs-remove', function () {
			if (state.selectedIndex < 0) return;
			state.fields.splice(state.selectedIndex, 1);
			state.selectedIndex = state.fields.length > 0 ? 0 : -1;
			renderCanvas();
		});

		$('#neo-pulse-field-palette-search').on('input', function () {
			var q = $(this).val().toLowerCase();
			$('.neo-pulse-field-palette-item').each(function () {
				var label = $(this).text().toLowerCase();
				$(this).closest('li').toggle(!q || label.indexOf(q) !== -1);
			});
		});

		if ($.fn.draggable && $.fn.sortable) {
			$('.neo-pulse-field-palette-item').draggable({
				connectToSortable: '#neo-pulse-form-fields-list',
				helper: 'clone',
				revert: 'invalid',
				appendTo: 'body',
				zIndex: 10000,
				start: function () {
					window._neo-pulseDragType = $(this).data('type');
				}
			});
			$('#neo-pulse-form-fields-list').on('sortreceive', function (event, ui) {
				if (!window._neo-pulseDragType) return;
				var type = window._neo-pulseDragType;
				window._neo-pulseDragType = null;
				ui.item.remove();
				addField(type);
			});
		}

		$('#neo-pulse-form-builder').on('submit', function () {
			syncFieldFromSettings();
			var emails = $('#neo-pulse-form-emails').val() || '';
			var payload = {
				ID: state.ID || 0,
				key: state.key,
				title: $('#neo-pulse-form-title').val() || '',
				active: $('#neo-pulse-form-active').is(':checked'),
				settings: {
					description: $('#neo-pulse-form-description').val() || '',
					submit_button_label: $('#neo-pulse-form-submit-label').val() || 'Submit',
					success_message: $('#neo-pulse-form-success').val() || '',
					redirect_url: $('#neo-pulse-form-redirect').val() || '',
					notification_emails: emails.split(',').map(function (e) {
						return e.trim();
					}),
					honeypot_enabled: $('#neo-pulse-form-honeypot').is(':checked'),
					store_ip: $('#neo-pulse-form-store-ip').is(':checked'),
					require_login: $('#neo-pulse-form-require-login').is(':checked')
				},
				fields: state.fields
			};
			$('#neo-pulse-form-json').val(JSON.stringify(payload));
		});
	});
})(jQuery);
