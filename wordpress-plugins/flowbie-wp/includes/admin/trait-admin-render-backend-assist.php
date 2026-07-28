<?php
/**
 * Backend Assist panel: centered chat modal with suggested actions.
 *
 * @package Flowbie_Wp
 */

defined( 'ABSPATH' ) || exit;

trait Flowbie_Wp_Admin_Trait_Render_Backend_Assist {

	/**
	 * Enqueue Backend Assist admin script (REST URLs + nonce via localize).
	 */
	public static function enqueue_backend_assist_script(): void {
		$rel = 'assets/admin/backend-assist/admin-backend-assist.js';
		$abs = FLOWBIE_WP_PLUGIN_DIR . $rel;
		if ( ! is_readable( $abs ) ) {
			return;
		}

		$ver = defined( 'FLOWBIE_WP_VERSION' ) ? FLOWBIE_WP_VERSION : '0.9.31';
		$ver .= '.' . (string) filemtime( $abs );

		wp_enqueue_script(
			'flowbie-wp-backend-assist',
			plugin_dir_url( FLOWBIE_WP_PLUGIN_FILE ) . $rel,
			array(),
			$ver,
			true
		);

		wp_localize_script(
			'flowbie-wp-backend-assist',
			'flowbieBackendAssist',
			array(
				'baseUrl'            => esc_url_raw( rest_url( 'flowbie/v1/backend-assist' ) ),
				'stepUrl'            => esc_url_raw( rest_url( 'flowbie/v1/backend-assist/step' ) ),
				'workflowStatusBase' => esc_url_raw( rest_url( 'flowbie/v1/backend-assist/workflow' ) ),
				'sessionsUrl'        => esc_url_raw( rest_url( 'flowbie/v1/backend-assist/sessions' ) ),
				'chatAjaxUrl'        => admin_url( 'admin-ajax.php' ),
				'chatStreamNonce'    => wp_create_nonce( 'flowbie_chat_stream' ),
				'nonce'              => wp_create_nonce( 'wp_rest' ),
				'brainSvg'           => self::brand_icon_svg( '#22d3ee', 32 ),
			)
		);
	}

	public static function render_backend_assist_page(): void {
		if ( ! current_user_can( 'edit_posts' ) ) {
			return;
		}

		$openrouter_ok = Flowbie_Wp_OpenRouter::get_api_key() !== '';
		$gsc_ok        = Flowbie_Wp_Gsc_Prompt::is_available();
		$gsc_url       = admin_url( 'admin.php?page=flowbie-wp-settings&tab=gsc' );
		self::flowbie_group_shell_open( 'flowbie-wp-backend-assist', 'flowbie-wp-panel-page fba-page' );
		?>
			<div class="fba-shell">
				<!-- Sidebar: session history -->
				<aside class="fba-sidebar" id="fba-sidebar">
					<div class="fba-sidebar-header">
						<button type="button" id="fba-new-chat" class="fba-sidebar-btn fba-sidebar-btn--new" title="<?php esc_attr_e( 'New Chat', 'flowbie-wp' ); ?>">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
							<?php esc_html_e( 'New Chat', 'flowbie-wp' ); ?>
						</button>
					</div>
					<div class="fba-sidebar-list" id="fba-sidebar-list"></div>
					<div class="fba-sidebar-footer">
						<button type="button" id="fba-clear-memory" class="fba-sidebar-btn fba-sidebar-btn--danger" title="<?php esc_attr_e( 'Clear all session history', 'flowbie-wp' ); ?>">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
							<?php esc_html_e( 'Clear Memory', 'flowbie-wp' ); ?>
						</button>
					</div>
				</aside>

				<!-- Main chat area -->
				<div class="fba-main">
					<?php if ( ! $openrouter_ok ) : ?>
						<div class="fba-alert" role="alert">
							<p><?php esc_html_e( 'Backend Assist requires an OpenRouter API key. Configure it under Settings > Editor AI.', 'flowbie-wp' ); ?></p>
						</div>
					<?php endif; ?>

					<div class="fba-chat" id="fba-chat">
						<div class="fba-messages" id="fba-messages"></div>

						<div class="fba-center" id="fba-center">
							<h2 class="fba-brand">Flow Assist</h2>
							<p class="fba-subtitle"><?php esc_html_e( 'Your WordPress backend specialist', 'flowbie-wp' ); ?></p>
							<p class="fba-gsc-status">
								<?php if ( $gsc_ok ) : ?>
									<span class="flowbie-wp-settings__gsc-status flowbie-wp-settings__gsc-status--ok"><?php esc_html_e( 'Search Console connected', 'flowbie-wp' ); ?></span>
								<?php else : ?>
									<span class="flowbie-wp-settings__gsc-status flowbie-wp-settings__gsc-status--error"><?php esc_html_e( 'Search Console not configured', 'flowbie-wp' ); ?></span>
									â€” <a href="<?php echo esc_url( $gsc_url ); ?>"><?php esc_html_e( 'Set up GSC', 'flowbie-wp' ); ?></a>
								<?php endif; ?>
							</p>

							<div class="fba-suggestions" id="fba-suggestions">
								<button type="button" class="fba-chip" data-prompt="Create a new page">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
									<?php esc_html_e( 'Create a page', 'flowbie-wp' ); ?>
								</button>
								<button type="button" class="fba-chip" data-prompt="Create a new blog post">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
									<?php esc_html_e( 'Create a post', 'flowbie-wp' ); ?>
								</button>
								<button type="button" class="fba-chip" data-prompt="List my recent drafts">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
									<?php esc_html_e( 'List recent drafts', 'flowbie-wp' ); ?>
								</button>
								<button type="button" class="fba-chip" data-prompt="Show me all published pages">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
									<?php esc_html_e( 'View pages', 'flowbie-wp' ); ?>
								</button>
								<button type="button" class="fba-chip" data-prompt="Add content to my page">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
									<?php esc_html_e( 'Add content', 'flowbie-wp' ); ?>
								</button>
							</div>
						</div>

						<div class="fba-input-wrap">
							<?php if ( $openrouter_ok ) : ?>
							<div class="fba-mode-toggle" id="fba-mode-toggle" role="group" aria-label="<?php esc_attr_e( 'Assist mode', 'flowbie-wp' ); ?>">
								<button type="button" class="fba-mode-btn fba-mode-btn--active" data-mode="backend"><?php esc_html_e( 'Backend', 'flowbie-wp' ); ?></button>
								<button type="button" class="fba-mode-btn" data-mode="chat"><?php esc_html_e( 'Flow Chat', 'flowbie-wp' ); ?></button>
							</div>
							<?php endif; ?>
							<div class="fba-input-row" id="fba-input-row">
								<input
									type="text"
									id="fba-input"
									class="fba-input"
									placeholder="<?php esc_attr_e( 'Write with Flow Assist...', 'flowbie-wp' ); ?>"
									autocomplete="off"
									<?php echo $openrouter_ok ? '' : 'disabled'; ?>
								/>
								<button type="button" id="fba-send" class="fba-send" aria-label="<?php esc_attr_e( 'Hold to speak', 'flowbie-wp' ); ?>" <?php echo $openrouter_ok ? '' : 'disabled'; ?>>
									<span class="fba-send__icon fba-send__icon--send" aria-hidden="true">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
									</span>
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

		<style>
			.fba-page{background:#0a0a0b!important;padding:0!important;margin:0!important;min-height:calc(100vh - 32px - 65px);display:flex;flex-direction:column;font-family:var(--fc-font,'Lato',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif);font-size:1rem}
			.fba-shell{display:flex;flex:1;flex-direction:row;min-height:0;margin:0;padding:0}

			/* Sidebar */
			.fba-sidebar{width:260px;min-width:260px;border-right:1px solid rgba(255,255,255,.07);display:flex;flex-direction:column;background:rgba(255,255,255,.02);padding:0}
			.fba-sidebar-header{padding:16px 16px 12px;border-bottom:1px solid rgba(255,255,255,.06)}
			.fba-sidebar-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font-size:1rem;cursor:pointer;transition:all .15s;font-family:inherit;width:100%;justify-content:center}
			.fba-sidebar-btn:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);color:#fff}
			.fba-sidebar-btn--new{background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.2);color:#4ade80}
			.fba-sidebar-btn--new:hover{background:rgba(74,222,128,.15);color:#86efac}
			.fba-sidebar-btn--danger{background:rgba(248,113,113,.06);border-color:rgba(248,113,113,.15);color:#f87171}
			.fba-sidebar-btn--danger:hover{background:rgba(248,113,113,.12);color:#fca5a5}
			.fba-sidebar-list{flex:1;overflow-y:auto;padding:8px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.06) transparent}
			.fba-sidebar-empty{padding:20px 12px;text-align:center;color:rgba(255,255,255,.78);font-size:1rem}
			.fba-sidebar-item{display:block;width:100%;text-align:left;padding:10px 12px;border-radius:8px;border:none;background:transparent;color:rgba(255,255,255,.85);font-size:1rem;cursor:pointer;transition:all .12s;margin-bottom:2px;font-family:inherit;line-height:1.4}
			.fba-sidebar-item:hover{background:rgba(255,255,255,.06);color:#fff}
			.fba-sidebar-item--active{background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(255,255,255,.1)}
			.fba-sidebar-item-title{font-weight:500;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
			.fba-sidebar-item-meta{font-size:1rem;color:rgba(255,255,255,.78)}
			.fba-sidebar-footer{padding:12px 16px;border-top:1px solid rgba(255,255,255,.06)}

			/* Main area */
			.fba-main{flex:1;display:flex;flex-direction:column;min-height:0;max-width:760px;margin:0 auto;padding:40px 24px 24px;min-width:0}

			.fba-alert{background:rgba(220,50,50,.12);border:1px solid rgba(220,50,50,.25);border-radius:10px;padding:12px 18px;margin-bottom:20px;color:#f87171;font-size:1rem}
			.fba-chat{flex:1;display:flex;flex-direction:column;position:relative}
			.fba-messages{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:0 0 20px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.08) transparent;min-height:0}
			.fba-messages:empty{display:none}
			.fba-messages:not(:empty)+.fba-center{display:none}
			.fba-center{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding-bottom:80px}
			.fba-brand{font-size:1.25rem;font-weight:700;color:#f0f0f0;margin:0;letter-spacing:-.3px}
			.fba-subtitle{font-size:1rem;color:rgba(255,255,255,.78);margin:0 0 20px}
			.fba-suggestions{display:flex;flex-wrap:wrap;justify-content:center;gap:8px;max-width:520px}
			.fba-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.7);font-size:1rem;cursor:pointer;transition:all .15s;font-family:inherit}
			.fba-chip:hover{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.2);color:#fff;transform:translateY(-1px)}
			.fba-chip svg{opacity:.5;flex-shrink:0}
			.fba-input-wrap{position:sticky;bottom:0;padding:16px 0 0;background:linear-gradient(to top,#0a0a0b 60%,transparent)}
			.fba-input-row{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:6px 8px 6px 16px;transition:border-color .2s,box-shadow .2s}
			.fba-input-row:focus-within{border-color:rgba(255,255,255,.25);box-shadow:0 0 0 3px rgba(255,255,255,.04)}
			.fba-input{flex:1;background:transparent;border:none;outline:none;color:#f0f0f0;font-size:1rem;padding:8px 4px;font-family:inherit}
			.fba-input::placeholder{color:rgba(255,255,255,.65)}
			.fba-input:disabled{opacity:.4;cursor:not-allowed}
			.fba-send{width:36px;height:36px;border-radius:50%;border:none;background:rgba(255,255,255,.1);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .15s,transform .1s;flex-shrink:0;touch-action:none;user-select:none}
			.fba-send:hover:not(:disabled){background:rgba(255,255,255,.18);transform:scale(1.05)}
			.fba-send:disabled{opacity:.3;cursor:not-allowed}

			.fba-user{align-self:flex-end;max-width:75%;padding:10px 16px;border-radius:18px 18px 4px 18px;background:rgba(255,255,255,.08);color:#f0f0f0;font-size:1rem;line-height:1.6;animation:fbaFadeUp .2s ease}
			.fba-card{border-radius:14px;padding:16px 20px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);font-size:1rem;line-height:1.7;color:rgba(240,240,240,.85);animation:fbaSlideUp .25s ease}
			.fba-card-header{display:flex;align-items:center;gap:8px;margin-bottom:8px}
			.fba-card-badge{padding:3px 8px;border-radius:6px;font-size:1rem;font-weight:600;text-transform:uppercase;letter-spacing:.4px;background:rgba(255,255,255,.07);color:rgba(255,255,255,.78)}
			.fba-card-badge--action{background:rgba(74,222,128,.1);color:#4ade80}
			.fba-card-badge--workflow{background:rgba(167,139,250,.12);color:#c4b5fd}
			.fba-card-badge--prompt{background:rgba(96,165,250,.1);color:#60a5fa}
			.fba-card-badge--error{background:rgba(248,113,113,.1);color:#f87171}
			.fba-card-title{font-weight:600;font-size:1rem;color:#f5f5f5}
			.fba-card-body{color:rgba(229,229,229,.92);margin-top:4px}
			.fba-card-body a{color:#a5b4fc;text-decoration:underline;text-underline-offset:2px}
			.fba-card-body a:hover{color:#c7d2fe}
			.fba-card-body strong{font-weight:600;color:#f5f5f5}
			.fba-card-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
			.fba-pill{display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);font-size:1rem;text-decoration:none;color:#e5e7eb;transition:all .15s}
			.fba-pill:hover{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2);color:#fff;text-decoration:none}
			.fba-card-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)}
			.fba-action-chip{padding:5px 14px;border-radius:16px;border:1px solid rgba(255,255,255,.1);background:transparent;color:rgba(255,255,255,.85);font-size:1rem;cursor:pointer;transition:all .15s;font-family:inherit}
			.fba-action-chip:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.2);color:#fff}
			.fba-workflow-steps{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:8px}
			.fba-workflow-step{display:flex;align-items:flex-start;gap:10px;font-size:1rem;color:rgba(240,240,240,.8);line-height:1.5}
			.fba-workflow-step-icon{flex-shrink:0;width:1.25rem;text-align:center;line-height:1.5}
			.fba-workflow-step--running .fba-workflow-step-icon{color:#60a5fa}
			.fba-workflow-step--done .fba-workflow-step-icon{color:#4ade80}
			.fba-workflow-step--error .fba-workflow-step-icon{color:#f87171}
			.fba-workflow-step--pending .fba-workflow-step-icon{color:rgba(255,255,255,.65)}
			.fba-workflow-step--plan .fba-workflow-step-label{font-weight:600;color:rgba(196,181,253,.95)}
			.fba-workflow-step--micro{padding-left:1.25rem}
			.fba-card--workflow-active{border-color:rgba(34,211,238,.35);animation:fbaNeonBreathe 2.8s ease-in-out infinite}
			.fba-workflow-step-icon--thinking{width:2rem;display:inline-flex;align-items:center;justify-content:center;text-align:center}
			.fba-workflow-step-icon--thinking svg{animation:fbaBrainPulse 1.4s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(34,211,238,.85))}
			.fba-loader{display:flex;gap:5px;padding:16px 0}
			.fba-loader span{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.15);animation:fbaBounce 1.2s infinite}
			.fba-loader span:nth-child(2){animation-delay:.15s}
			.fba-loader span:nth-child(3){animation-delay:.3s}

			@keyframes fbaBounce{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-5px);opacity:1}}
			@keyframes fbaFadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
			@keyframes fbaSlideUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
			@keyframes fbaNeonBreathe{0%,100%{box-shadow:0 0 12px rgba(34,211,238,.15),0 0 24px rgba(96,165,250,.08)}50%{box-shadow:0 0 20px rgba(34,211,238,.45),0 0 40px rgba(96,165,250,.22)}}
			@keyframes fbaBrainPulse{0%,100%{transform:scale(.92);opacity:.85}50%{transform:scale(1.06);opacity:1}}

			@media(max-width:768px){
				.fba-shell{flex-direction:column}
				.fba-sidebar{width:100%;min-width:0;max-height:180px;border-right:none;border-bottom:1px solid rgba(255,255,255,.07)}
				.fba-main{padding:20px 16px 16px}
			}
		</style>
		<?php
		self::flowbie_group_shell_close();
	}
}
