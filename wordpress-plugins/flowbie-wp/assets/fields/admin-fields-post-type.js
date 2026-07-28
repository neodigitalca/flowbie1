(function ($) {
	'use strict';

	function syncAdvancedCard() {
		var $toggle = $('#flowbie-pt-toggle-advanced_configuration');
		var $card = $('#flowbie-pt-advanced-card');
		if (!$toggle.length || !$card.length) {
			return;
		}
		$card.toggleClass('flowbie-fields-acf-pt-card--collapsed', !$toggle.is(':checked'));
	}

	$(document).on('change', '#flowbie-pt-toggle-advanced_configuration', syncAdvancedCard);

	$(document).on('click', '.flowbie-fields-acf-pt-tab', function () {
		var tab = $(this).data('pt-tab');
		$('.flowbie-fields-acf-pt-tab').removeClass('is-active');
		$(this).addClass('is-active');
		$('.flowbie-fields-acf-pt-tab-panel').removeClass('is-active');
		$('.flowbie-fields-acf-pt-tab-panel[data-pt-panel="' + tab + '"]').addClass('is-active');
	});

	$(function () {
		syncAdvancedCard();
	});
})(jQuery);
