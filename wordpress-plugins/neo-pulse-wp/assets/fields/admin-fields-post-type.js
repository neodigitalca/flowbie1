(function ($) {
	'use strict';

	function syncAdvancedCard() {
		var $toggle = $('#neo-pulse-pt-toggle-advanced_configuration');
		var $card = $('#neo-pulse-pt-advanced-card');
		if (!$toggle.length || !$card.length) {
			return;
		}
		$card.toggleClass('neo-pulse-fields-acf-pt-card--collapsed', !$toggle.is(':checked'));
	}

	$(document).on('change', '#neo-pulse-pt-toggle-advanced_configuration', syncAdvancedCard);

	$(document).on('click', '.neo-pulse-fields-acf-pt-tab', function () {
		var tab = $(this).data('pt-tab');
		$('.neo-pulse-fields-acf-pt-tab').removeClass('is-active');
		$(this).addClass('is-active');
		$('.neo-pulse-fields-acf-pt-tab-panel').removeClass('is-active');
		$('.neo-pulse-fields-acf-pt-tab-panel[data-pt-panel="' + tab + '"]').addClass('is-active');
	});

	$(function () {
		syncAdvancedCard();
	});
})(jQuery);
