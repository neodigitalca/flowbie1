(function ($) {
	'use strict';

	$(function () {
		$('.flowbie-tab').on('click', function () {
			var tab = $(this).data('tab');
			$('.flowbie-tab').removeClass('active');
			$(this).addClass('active');
			$('.flowbie-tab-panel').removeClass('active');
			$('.flowbie-tab-panel[data-panel="' + tab + '"]').addClass('active');
		});

		var rowIndex = $('#flowbie-fields-rows tr').length;

		$('#flowbie-add-field').on('click', function () {
			var types = (window.flowbieFieldsBuilder && flowbieFieldsBuilder.fieldTypes) || { text: 'Text' };
			var options = '';
			Object.keys(types).forEach(function (t) {
				options += '<option value="' + t + '">' + types[t] + '</option>';
			});
			var key = 'field_' + Date.now();
			var html = '<tr class="flowbie-field-row" data-index="' + rowIndex + '">' +
				'<td class="flowbie-sort-handle">☰</td>' +
				'<td><input type="text" name="fields[' + rowIndex + '][label]" value="" /></td>' +
				'<td><input type="text" name="fields[' + rowIndex + '][name]" value="" /></td>' +
				'<td><select name="fields[' + rowIndex + '][type]">' + options + '</select></td>' +
				'<td><input type="hidden" name="fields[' + rowIndex + '][key]" value="' + key + '" />' +
				'<button type="button" class="button-link flowbie-remove-field">&times;</button></td></tr>';
			$('#flowbie-fields-rows').append(html);
			rowIndex += 1;
		});

		$(document).on('click', '.flowbie-remove-field', function () {
			$(this).closest('tr').remove();
		});

		if ($.fn.sortable) {
			$('#flowbie-fields-rows').sortable({ handle: '.flowbie-sort-handle' });
		}

		$('#flowbie-add-rule-group').on('click', function () {
			var gi = $('.flowbie-location-group').length;
			var html = '<div class="flowbie-location-group" data-group="' + gi + '">' +
				'<div class="flowbie-location-rule">' +
				'<select name="location[' + gi + '][0][param]"><option value="post_type">Post Type</option></select> ' +
				'<select name="location[' + gi + '][0][operator]"><option value="==">is equal to</option></select> ' +
				'<input type="text" name="location[' + gi + '][0][value]" value="page" />' +
				'</div>' +
				'<button type="button" class="button flowbie-add-rule" data-group="' + gi + '">and</button></div>';
			$('#flowbie-location-rules').append(html);
		});

		$(document).on('click', '.flowbie-add-rule', function () {
			var gi = $(this).data('group');
			var ri = $(this).closest('.flowbie-location-group').find('.flowbie-location-rule').length;
			var html = '<div class="flowbie-location-rule">' +
				'<select name="location[' + gi + '][' + ri + '][param]"><option value="post_type">Post Type</option></select> ' +
				'<select name="location[' + gi + '][' + ri + '][operator]"><option value="==">is equal to</option></select> ' +
				'<input type="text" name="location[' + gi + '][' + ri + '][value]" value="" />' +
				'</div>';
			$(this).before(html);
		});
	});
})(jQuery);
