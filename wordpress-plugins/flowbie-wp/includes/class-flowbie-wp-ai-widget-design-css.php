<?php
/**
 * CSS var builders + color helpers for AI widget design.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Ai_Widget_Design_Css {

	/**
	 * Default light Site Branding fallback (identical for chat + search).
	 *
	 * @return array<string,mixed>
	 */
	public static function fallback_palette(): array {
		return array(
			'bg'                   => '#ffffff',
			'bg_elevated'          => '#f8fafc',
			'card_bg'              => '#ffffff',
			'dropdown_bg'          => '#ffffff',
			'input_bg'             => '#ffffff',
			'header_bg'            => '#f8fafc',
			'launcher_bg'          => '#3b82f6',
			'text'                 => '#1e293b',
			'text_secondary'       => '#475569',
			'text_muted'           => '#64748b',
			'link'                 => '#2563eb',
			'placeholder'          => '#94a3b8',
			'border'               => '#cbd5e1',
			'border_hover'         => '#94a3b8',
			'focus_ring'           => '#3b82f6',
			'accent'               => '#3b82f6',
			'accent_text'          => '#ffffff',
			'highlight'            => '#06b6d4',
			'button_bg'            => '#3b82f6',
			'button_text'          => '#ffffff',
			'button_hover'         => '#2563eb',
			'user_bubble_bg'       => '#3b82f6',
			'user_bubble_text'     => '#ffffff',
			'assistant_bubble_bg'  => '#f1f5f9',
			'assistant_bubble_text'=> '#1e293b',
			'thinking_border'      => '#06b6d4',
			'mic_idle'             => '#3b82f6',
			'mic_recording'        => '#22c55e',
			'send_bg'              => '#3b82f6',
			'result_hover'         => '#f1f5f9',
			'score_color'          => '#64748b',
			'banner_bg'            => '#eff6ff',
			'banner_text'          => '#1e40af',
			'powered_text'         => '#64748b',
			'powered_icon'         => '#3b82f6',
			'icon_color'           => '#3b82f6',
			'button_border'        => '#cbd5e1',
			'form_border'          => '#cbd5e1',
			'input_text'           => '#1e293b',
			'radius'               => 8,
			'radius_sm'            => 6,
			'font_size'            => 16,
			'font_family'          => 'Lato',
			'shadow'               => '0 4px 24px rgba(0, 0, 0, 0.12)',
			'launcher_size'        => 56,
			'panel_width'          => 380,
			'panel_max_height'     => 560,
			'offset_x'             => 20,
			'offset_y'             => 20,
			'z_index'              => 999999,
		);
	}

	/**
	 * @return string[]
	 */
	public static function color_token_keys(): array {
		return array(
			'bg', 'bg_elevated', 'card_bg', 'dropdown_bg', 'input_bg', 'header_bg', 'launcher_bg',
			'text', 'text_secondary', 'text_muted', 'link', 'placeholder',
			'border', 'border_hover', 'focus_ring',
			'accent', 'accent_text', 'highlight', 'button_bg', 'button_text', 'button_hover',
			'user_bubble_bg', 'user_bubble_text', 'assistant_bubble_bg', 'assistant_bubble_text',
			'thinking_border', 'mic_idle', 'mic_recording', 'send_bg',
			'result_hover', 'score_color', 'banner_bg', 'banner_text',
			'powered_text', 'powered_icon', 'icon_color', 'button_border', 'form_border', 'input_text',
		);
	}

	/**
	 * Keys Site Branding may overlay from the Elementor kit (brand roles only).
	 *
	 * @return string[]
	 */
	public static function site_branding_token_keys(): array {
		return array(
			'accent', 'accent_text', 'button_bg', 'button_text', 'button_hover',
			'launcher_bg', 'send_bg', 'mic_idle', 'focus_ring', 'link',
			'user_bubble_bg', 'bg_elevated', 'header_bg', 'assistant_bubble_bg',
			'result_hover', 'highlight', 'thinking_border', 'banner_bg', 'banner_text',
			'text', 'assistant_bubble_text', 'text_secondary', 'text_muted',
			'placeholder', 'border', 'border_hover', 'score_color',
		);
	}

	/**
	 * @return string[]
	 */
	public static function shape_token_keys(): array {
		return array(
			'radius', 'radius_sm', 'font_size', 'font_family', 'shadow',
			'launcher_size', 'panel_width', 'panel_max_height', 'offset_x', 'offset_y', 'z_index',
		);
	}

	/**
	 * @return array<string,bool>
	 */
	public static function default_chat_visibility(): array {
		return array(
			'launcher' => true, 'header' => true, 'avatar' => true, 'assistant_name' => true,
			'close_button' => true, 'welcome_message' => true, 'thinking_card' => true,
			'source_pills' => true, 'cta_buttons' => true, 'suggestion_chips' => true,
			'confidence' => true, 'powered_by' => true, 'send_button' => true,
			'mic_button' => true, 'voice_toast' => true,
		);
	}

	/**
	 * @return array<string,bool>
	 */
	public static function default_search_visibility(): array {
		return array(
			'search_icon' => true, 'submit_button' => true, 'clear_button' => true,
			'ai_banner' => true, 'relevance_scores' => true, 'powered_by' => true,
			'dropdown_shadow' => true, 'empty_state' => true,
		);
	}

	/**
	 * @return array<string,mixed>
	 */
	public static function defaults(): array {
		$palette = self::fallback_palette();
		return array(
			'style_scope'  => 'both',
			'color_source' => 'site_branding',
			'shared'       => $palette,
			'chat'         => $palette,
			'search'       => $palette,
			'chat_ui'      => self::default_chat_visibility(),
			'search_ui'    => self::default_search_visibility(),
		);
	}

	/**
	 * Build inline CSS custom properties for chat (--fcw-*).
	 *
	 * @param array<string,mixed>|null $tokens
	 */
	public static function build_chat_css_vars( ?array $tokens = null ): string {
		$t = $tokens ?? self::resolve( 'chat' );
		$map = array(
			'bg' => 'bg', 'bg_elevated' => 'bg-elevated', 'card_bg' => 'card-bg',
			'input_bg' => 'input-bg', 'header_bg' => 'header-bg', 'launcher_bg' => 'launcher-bg',
			'text' => 'text', 'text_secondary' => 'text-secondary', 'text_muted' => 'text-muted',
			'link' => 'link', 'placeholder' => 'placeholder',
			'border' => 'border', 'border_hover' => 'border-hover', 'focus_ring' => 'focus-ring',
			'accent' => 'accent', 'accent_text' => 'accent-text', 'highlight' => 'highlight',
			'button_bg' => 'button-bg', 'button_text' => 'button-text', 'button_hover' => 'button-hover',
			'user_bubble_bg' => 'user-bubble-bg', 'user_bubble_text' => 'user-bubble-text',
			'assistant_bubble_bg' => 'assistant-bubble-bg', 'assistant_bubble_text' => 'assistant-bubble-text',
			'thinking_border' => 'thinking-border', 'mic_idle' => 'mic-idle',
			'mic_recording' => 'mic-recording', 'send_bg' => 'send-bg',
			'powered_text' => 'powered', 'powered_icon' => 'powered-icon',
			'icon_color' => 'icon', 'button_border' => 'button-border',
			'form_border' => 'form-border', 'input_text' => 'input-text',
			'shadow' => 'shadow', 'font_family' => 'font-family',
		);
		$parts = array();
		foreach ( $map as $key => $css ) {
			if ( ! isset( $t[ $key ] ) ) {
				continue;
			}
			$parts[] = '--fcw-' . $css . ':' . esc_attr( (string) $t[ $key ] );
		}
		$parts[] = '--fcw-radius:' . (int) ( $t['radius'] ?? 8 ) . 'px';
		$parts[] = '--fcw-radius-sm:' . (int) ( $t['radius_sm'] ?? 6 ) . 'px';
		$parts[] = '--fcw-font-size:' . max( 16, (int) ( $t['font_size'] ?? 16 ) ) . 'px';
		$parts[] = '--fcw-bubble-size:' . max( 40, (int) ( $t['launcher_size'] ?? 56 ) ) . 'px';
		$parts[] = '--fcw-panel-width:' . max( 280, (int) ( $t['panel_width'] ?? 380 ) ) . 'px';
		$parts[] = '--fcw-panel-max-height:' . max( 320, (int) ( $t['panel_max_height'] ?? 560 ) ) . 'px';
		$parts[] = '--fcw-offset-x:' . max( 0, (int) ( $t['offset_x'] ?? 20 ) ) . 'px';
		$parts[] = '--fcw-offset-y:' . max( 0, (int) ( $t['offset_y'] ?? 20 ) ) . 'px';
		$parts[] = '--fcw-z-index:' . max( 1, (int) ( $t['z_index'] ?? 999999 ) );
		return implode( ';', $parts ) . ';';
	}

	/**
	 * Build inline CSS custom properties for search (--fbs-*).
	 *
	 * @param array<string,mixed>|null $tokens
	 * @param array<string,mixed>      $instance
	 */
	public static function build_search_css_vars( ?array $tokens = null, array $instance = array() ): string {
		$t = $tokens ?? self::resolve( 'search' );
		$max_width = isset( $instance['max_width'] ) && $instance['max_width'] !== ''
			? (string) $instance['max_width']
			: '520px';

		$parts = array(
			'--fbs-primary:' . esc_attr( (string) ( $t['accent'] ?? '#3b82f6' ) ),
			'--fbs-bg:' . esc_attr( (string) ( $t['bg'] ?? '#ffffff' ) ),
			'--fbs-radius:' . (int) ( $t['radius'] ?? 8 ) . 'px',
			'--fbs-font-size:' . max( 16, (int) ( $t['font_size'] ?? 16 ) ) . 'px',
			'--fbs-text:' . esc_attr( (string) ( $t['text'] ?? '#1e293b' ) ),
			'--fbs-text-muted:' . esc_attr( (string) ( $t['text_muted'] ?? '#64748b' ) ),
			'--fbs-text-secondary:' . esc_attr( (string) ( $t['text_secondary'] ?? '#475569' ) ),
			'--fbs-border:' . esc_attr( (string) ( $t['border'] ?? '#cbd5e1' ) ),
			'--fbs-border-hover:' . esc_attr( (string) ( $t['border_hover'] ?? '#94a3b8' ) ),
			'--fbs-hover:' . esc_attr( (string) ( $t['result_hover'] ?? '#f1f5f9' ) ),
			'--fbs-dropdown-bg:' . esc_attr( (string) ( $t['dropdown_bg'] ?? $t['bg'] ?? '#ffffff' ) ),
			'--fbs-dropdown-radius:' . (int) ( $t['radius'] ?? 8 ) . 'px',
			'--fbs-max-width:' . esc_attr( $max_width ),
			'--fbs-shadow:' . esc_attr( (string) ( $t['shadow'] ?? '0 4px 24px rgba(0, 0, 0, 0.12)' ) ),
			'--fbs-input-bg:' . esc_attr( (string) ( $t['input_bg'] ?? '#ffffff' ) ),
			'--fbs-placeholder:' . esc_attr( (string) ( $t['placeholder'] ?? '#94a3b8' ) ),
			'--fbs-button-bg:' . esc_attr( (string) ( $t['button_bg'] ?? $t['accent'] ?? '#3b82f6' ) ),
			'--fbs-button-text:' . esc_attr( (string) ( $t['button_text'] ?? '#ffffff' ) ),
			'--fbs-button-hover:' . esc_attr( (string) ( $t['button_hover'] ?? '#2563eb' ) ),
			'--fbs-focus-ring:' . esc_attr( (string) ( $t['focus_ring'] ?? '#3b82f6' ) ),
			'--fbs-link:' . esc_attr( (string) ( $t['link'] ?? '#2563eb' ) ),
			'--fbs-score:' . esc_attr( (string) ( $t['score_color'] ?? '#64748b' ) ),
			'--fbs-banner-bg:' . esc_attr( (string) ( $t['banner_bg'] ?? '#eff6ff' ) ),
			'--fbs-banner-text:' . esc_attr( (string) ( $t['banner_text'] ?? '#1e40af' ) ),
			'--fbs-powered:' . esc_attr( (string) ( $t['powered_text'] ?? $t['text_muted'] ?? '#64748b' ) ),
			'--fbs-powered-icon:' . esc_attr( (string) ( $t['powered_icon'] ?? $t['accent'] ?? '#3b82f6' ) ),
			'--fbs-icon:' . esc_attr( (string) ( $t['icon_color'] ?? $t['accent'] ?? '#3b82f6' ) ),
			'--fbs-button-border:' . esc_attr( (string) ( $t['button_border'] ?? $t['border'] ?? '#cbd5e1' ) ),
			'--fbs-form-border:' . esc_attr( (string) ( $t['form_border'] ?? $t['border'] ?? '#cbd5e1' ) ),
			'--fbs-input-text:' . esc_attr( (string) ( $t['input_text'] ?? $t['text'] ?? '#1e293b' ) ),
			'--fbs-font-family:' . esc_attr( (string) ( $t['font_family'] ?? 'Lato' ) ),
		);
		return implode( ';', $parts ) . ';';
	}

	/**
	 * Accept #RRGGBB or rgba(r,g,b,a) with numeric channels only.
	 */
	public static function sanitize_color_value( string $value ): string {
		$value = trim( $value );
		$hex   = sanitize_hex_color( $value );
		if ( $hex ) {
			return $hex;
		}
		if ( strpos( $value, 'rgba(' ) !== 0 && strpos( $value, 'rgb(' ) !== 0 ) {
			return '';
		}
		$inner = substr( $value, strpos( $value, '(' ) + 1 );
		$inner = rtrim( $inner, ')' );
		$parts = array_map( 'trim', explode( ',', $inner ) );
		if ( count( $parts ) < 3 || count( $parts ) > 4 ) {
			return '';
		}
		$r = (int) $parts[0];
		$g = (int) $parts[1];
		$b = (int) $parts[2];
		if ( $r < 0 || $r > 255 || $g < 0 || $g > 255 || $b < 0 || $b > 255 ) {
			return '';
		}
		if ( count( $parts ) === 3 ) {
			return sprintf( 'rgb(%d,%d,%d)', $r, $g, $b );
		}
		$a = (float) $parts[3];
		if ( $a < 0 || $a > 1 ) {
			return '';
		}
		return sprintf( 'rgba(%d,%d,%d,%s)', $r, $g, $b, rtrim( rtrim( number_format( $a, 3, '.', '' ), '0' ), '.' ) );
	}

	/**
	 * Darken a hex color by percent (0-100).
	 */
	public static function darken_hex( string $hex, int $percent ): string {
		$rgb = self::hex_to_rgb( $hex );
		if ( ! $rgb ) {
			return $hex;
		}
		$f = max( 0, min( 100, $percent ) ) / 100;
		return sprintf(
			'#%02x%02x%02x',
			(int) max( 0, $rgb[0] * ( 1 - $f ) ),
			(int) max( 0, $rgb[1] * ( 1 - $f ) ),
			(int) max( 0, $rgb[2] * ( 1 - $f ) )
		);
	}

	/**
	 * Mix hex toward white by percent (0-100 toward white).
	 */
	public static function mix_hex_white( string $hex, int $percent ): string {
		$rgb = self::hex_to_rgb( $hex );
		if ( ! $rgb ) {
			return $hex;
		}
		$f = max( 0, min( 100, $percent ) ) / 100;
		return sprintf(
			'#%02x%02x%02x',
			(int) ( $rgb[0] + ( 255 - $rgb[0] ) * $f ),
			(int) ( $rgb[1] + ( 255 - $rgb[1] ) * $f ),
			(int) ( $rgb[2] + ( 255 - $rgb[2] ) * $f )
		);
	}

	/**
	 * sRGB relative luminance (0 = black, 1 = white).
	 */
	public static function relative_luminance( string $hex ): float {
		$rgb = self::hex_to_rgb( $hex );
		if ( ! $rgb ) {
			return 0.0;
		}
		$channels = array();
		foreach ( $rgb as $value ) {
			$v = $value / 255;
			$channels[] = $v <= 0.03928 ? $v / 12.92 : pow( ( $v + 0.055 ) / 1.055, 2.4 );
		}
		return 0.2126 * $channels[0] + 0.7152 * $channels[1] + 0.0722 * $channels[2];
	}

	/**
	 * @return array{0:int,1:int,2:int}|null
	 */
	private static function hex_to_rgb( string $hex ): ?array {
		$hex = sanitize_hex_color( $hex );
		if ( ! $hex || strlen( $hex ) !== 7 ) {
			return null;
		}
		return array(
			hexdec( substr( $hex, 1, 2 ) ),
			hexdec( substr( $hex, 3, 2 ) ),
			hexdec( substr( $hex, 5, 2 ) ),
		);
	}
}
