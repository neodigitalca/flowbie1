(function ($) {
	'use strict';

	$(function () {
		$('.neo-pulse-tab').on('click', function () {
			var tab = $(this).data('tab');
			$('.neo-pulse-tab').removeClass('active');
			$(this).addClass('active');
			$('.neo-pulse-tab-panel').removeClass('active');
			$('.neo-pulse-tab-panel[data-panel="' + tab + '"]').addClass('active');
		});

		var rowIndex = $('#neo-pulse-fields-rows tr').length;

		$('#neo-pulse-add-field').on('click', function () {
			var types = (window.neoPulseFieldsBuilder && neoPulseFieldsBuilder.fieldTypes) || { text: 'Text' };
			var options = '';
			Object.keys(types).forEach(function (t) {
				options += '<option value="' + t + '">' + types[t] + '</option>';
			});
			var key = 'field_' + Date.now();
			var html = '<tr class="neo-pulse-field-row" data-index="' + rowIndex + '">' +
				'<td class="neo-pulse-sort-handle">☰</td>' +
				'<td><input type="text" name="fields[' + rowIndex + '][label]" value="" /></td>' +
				'<td><input type="text" name="fields[' + rowIndex + '][name]" value="" /></td>' +
				'<td><select name="fields[' + rowIndex + '][type]">' + options + '</select></td>' +
				'<td><input type="hidden" name="fields[' + rowIndex + '][key]" value="' + key + '" />' +
				'<button type="button" class="button-link neo-pulse-remove-field">&times;</button></td></tr>';
			$('#neo-pulse-fields-rows').append(html);
			rowIndex += 1;
		});

		$(document).on('click', '.neo-pulse-remove-field', function () {
			$(this).closest('tr').remove();
		});

		if ($.fn.sortable) {
			$('#neo-pulse-fields-rows').sortable({ handle: '.neo-pulse-sort-handle' });
		}

		$('#neo-pulse-add-rule-group').on('click', function () {
			var gi = $('.neo-pulse-location-group').length;
			var html = '<div class="neo-pulse-location-group" data-group="' + gi + '">' +
				'<div class="neo-pulse-location-rule">' +
				'<select name="location[' + gi + '][0][param]"><option value="post_type">Post Type</option></select> ' +
				'<select name="location[' + gi + '][0][operator]"><option value="==">is equal to</option></select> ' +
				'<input type="text" name="location[' + gi + '][0][value]" value="page" />' +
				'</div>' +
				'<button type="button" class="button neo-pulse-add-rule" data-group="' + gi + '">and</button></div>';
			$('#neo-pulse-location-rules').append(html);
		});

		$(document).on('click', '.neo-pulse-add-rule', function () {
			var gi = $(this).data('group');
			var ri = $(this).closest('.neo-pulse-location-group').find('.neo-pulse-location-rule').length;
			var html = '<div class="neo-pulse-location-rule">' +
				'<select name="location[' + gi + '][' + ri + '][param]"><option value="post_type">Post Type</option></select> ' +
				'<select name="location[' + gi + '][' + ri + '][operator]"><option value="==">is equal to</option></select> ' +
				'<input type="text" name="location[' + gi + '][' + ri + '][value]" value="" />' +
				'</div>';
			$(this).before(html);
		});
	});
})(jQuery);
