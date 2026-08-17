/**
 * Gallery — select all + bulk delete confirm.
 */
( function ( $ ) {
	function templateInputs() {
		return $( '.neo-pulse-fields-acf-gallery__template-input' );
	}

	function syncSelectAll() {
		var $inputs = templateInputs();
		var $selectAll = $( '.neo-pulse-fields-acf-gallery__select-all-input' );
		if ( ! $selectAll.length || ! $inputs.length ) {
			return;
		}
		var checked = $inputs.filter( ':checked' ).length;
		$selectAll.prop( 'checked', checked > 0 && checked === $inputs.length );
		$selectAll.prop( 'indeterminate', checked > 0 && checked < $inputs.length );
	}

	$( function () {
		var $bulkForm = $( '#neo-pulse-fields-acf-gallery-bulk' );

		$( '.neo-pulse-fields-acf-gallery__select-all-input' ).on( 'change', function () {
			var checked = $( this ).prop( 'checked' );
			templateInputs().prop( 'checked', checked );
			$( this ).prop( 'indeterminate', false );
		} );

		$( document ).on( 'change', '.neo-pulse-fields-acf-gallery__template-input', syncSelectAll );

		$bulkForm.on( 'submit', function ( event ) {
			var $checked = templateInputs().filter( ':checked' );
			if ( ! $checked.length ) {
				event.preventDefault();
				window.alert( $bulkForm.attr( 'data-empty-notice' ) || '' );
				return;
			}
			var message = $bulkForm.attr( 'data-confirm' );
			if ( message && ! window.confirm( message ) ) {
				event.preventDefault();
			}
		} );

		syncSelectAll();
	} );
}( jQuery ) );
