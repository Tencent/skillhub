window.__ModuleLoader__.load({
  id: "@tencent/skillhub",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;
    const { useEffect, useState } = React;

    const CSS = `
.sh-root{font-family:inherit;color:var(--dsw-alias-label-primary,inherit);max-width:920px}
.sh-hint{color:var(--dsw-alias-label-caption,#6b7280);font-size:12px;line-height:18px;margin:0 0 10px}
.sh-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
@media (max-width:640px){.sh-cards{grid-template-columns:1fr}}
.sh-card{display:flex;gap:12px;align-items:flex-start;background:var(--dsw-alias-bg-layer-3,#fff);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;padding:12px;cursor:pointer;text-align:left;width:100%;font:inherit;color:var(--dsw-alias-label-primary,inherit);transition:border-color .16s,background .16s}
.sh-card:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(38,49,72,.06));border-color:var(--dsw-alias-label-dimmed,#c7d2fe)}
.sh-card.on{border-color:var(--dsw-alias-state-success-primary,#86efac)}
.sh-icon{width:40px;height:40px;border-radius:10px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);flex-shrink:0;background:linear-gradient(135deg,#c7d2fe,#fbcfe8);display:grid;place-items:center;font-weight:700;font-size:12px;color:#374151}
.sh-meta{min-width:0;flex:1;display:flex;flex-direction:column;gap:2px}
.sh-top{display:flex;align-items:center;gap:8px;min-width:0}
.sh-title{flex:1;min-width:0;font-weight:600;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary,inherit);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-badge{flex:none;font-size:11px;line-height:16px;padding:0 6px;border-radius:999px;background:var(--dsw-alias-state-success-tertiary,#ecfdf5);color:var(--dsw-alias-state-success-primary,#047857)}
.sh-desc{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:12px;line-height:18px;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.sh-marks{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:2px 0 0;min-width:0}
.sh-rate{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:16px;color:#b45309;white-space:nowrap}
.sh-stars{color:#f59e0b;letter-spacing:.5px;font-size:11px}
.sh-safe{display:inline-flex;align-items:center;gap:6px;margin-left:20px;font-size:12px;line-height:16px;color:var(--dsw-alias-label-primary,inherit);white-space:nowrap}
.sh-safe .sh-sec-ico{width:16px;height:16px}
.sh-bluev{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:16px;color:#2563eb;white-space:nowrap;min-width:0}
.sh-bluev i{width:14px;height:14px;border-radius:50%;background:#2563eb;color:#fff;font-style:normal;font-size:9px;font-weight:800;display:inline-grid;place-items:center;line-height:1;flex:none}
.sh-bluev span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.sh-canon{font-size:12px;color:var(--dsw-alias-label-caption,#9ca3af);margin:0 0 8px}
.sh-overview{margin:0;font-size:14px;line-height:1.75;color:var(--dsw-alias-label-secondary,#374151);white-space:pre-wrap}
.sh-head .sh-marks{margin:0 0 8px}
.sh-head .sh-rate,.sh-head .sh-bluev,.sh-head .sh-safe{font-size:12px}
.sh-head .sh-stars{font-size:12px}
.sh-head .sh-bluev i{width:16px;height:16px;font-size:10px}
.sh-footline{color:var(--dsw-alias-label-caption,#9ca3af);font-size:11px;line-height:16px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sh-tags{display:flex;flex-wrap:wrap;gap:4px}
.sh-tag{font-size:11px;padding:2px 6px;border-radius:6px;background:var(--dsw-alias-markdown-tag,#f3f4f6);color:var(--dsw-alias-label-secondary,#4b5563)}
.sh-tag.blue{background:var(--dsw-alias-state-business-tertiary,#eff6ff);color:var(--dsw-alias-state-business-primary,#1d4ed8)}
.sh-tag.green{background:var(--dsw-alias-state-success-tertiary,#ecfdf5);color:var(--dsw-alias-state-success-primary,#047857)}
.sh-tag.orange{background:var(--dsw-alias-state-warn-tertiary,#fff7ed);color:var(--dsw-alias-state-warn-label,#c2410c)}
.sh-slug{color:var(--dsw-alias-label-caption,#9ca3af);font-size:11px;margin-top:auto}
.sh-overlay{position:fixed;inset:0;z-index:2147483000;background:var(--dsw-alias-bg-mask-3,rgba(15,23,42,.48));display:flex;align-items:center;justify-content:center;padding:24px 16px;box-sizing:border-box}
.sh-drawer{position:relative;width:min(720px,100%);max-height:min(86vh,840px);margin:0 auto;background:var(--dsw-alias-bg-layer-2,#fff);color:var(--dsw-alias-label-primary,inherit);border:1px solid var(--dsw-alias-border-l2,#9aa5b5);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 18px 50px rgba(15,23,42,.28)}
.sh-drawer.sh-skill{width:min(840px,100%);height:min(86vh,860px);max-height:min(86vh,860px)}
.sh-close{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);background:var(--dsw-alias-bg-layer-3,#fff);cursor:pointer;font-size:18px;line-height:1;color:var(--dsw-alias-label-secondary,#4b5563);z-index:2}
.sh-close:hover{background:var(--dsw-alias-interactive-bg-hover,#f3f4f6)}
.sh-head{display:flex;gap:14px;align-items:flex-start;padding:18px 48px 16px 18px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb)}
.sh-dicon{width:64px;height:64px;border-radius:12px;display:grid;place-items:center;font-weight:800;background:linear-gradient(135deg,#c7d2fe,#fbcfe8);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);flex-shrink:0;object-fit:cover}
.sh-head h2{margin:0 0 6px;font-size:18px;line-height:1.35;color:var(--dsw-alias-label-primary,inherit)}
.sh-body{overflow:auto;padding:12px 18px 20px}
.sh-drawer.sh-skill .sh-body{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:16px 22px 0}
.sh-pane{flex:1;min-height:0;overflow:auto;padding:16px 2px 28px}
.sh-stats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;flex:none}
.sh-stat{font-size:12px;padding:6px 10px;border-radius:8px;background:var(--dsw-alias-bg-module-platform,#f7f8fa);border:1px solid var(--dsw-alias-border-l2,#e5e7eb);color:var(--dsw-alias-label-secondary,inherit)}
.sh-tabs{display:flex;gap:16px;margin:0 -22px;padding:0 22px;border-bottom:1px solid var(--dsw-alias-border-l2,#e5e7eb);overflow-x:auto;scrollbar-width:none;flex:none}
.sh-tabs::-webkit-scrollbar{display:none}
.sh-tab{appearance:none;flex:none;background:0 0;border:0;border-bottom:2px solid transparent;margin-bottom:-1px;padding:10px 0 12px;font:inherit;font-size:13px;line-height:20px;color:var(--dsw-alias-label-tertiary,#6b7280);cursor:pointer;white-space:nowrap}
.sh-tab.on{color:var(--dsw-alias-label-primary,inherit);border-bottom-color:var(--dsw-alias-label-primary,#111827);font-weight:650}
.sh-ver-card{display:flex;gap:12px;align-items:flex-start;justify-content:space-between;padding:16px 18px;margin:0 0 12px;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:12px;background:var(--dsw-alias-bg-layer-3,#fff)}
.sh-ver-main{min-width:0;flex:1}
.sh-ver-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px}
.sh-ver-head b{font-size:15px}
.sh-ver-log{margin:8px 0 0;font-size:13px;line-height:1.7;color:var(--dsw-alias-label-secondary,#4b5563)}
.sh-ver-card .sh-mini{flex:none;align-self:center;white-space:nowrap}
.sh-eval-hero{display:grid;grid-template-columns:200px minmax(0,1fr);gap:24px;align-items:start;border:1px solid var(--dsw-alias-border-l2,#e5e7eb);border-radius:16px;padding:20px 22px;margin:0 0 22px;background:var(--dsw-alias-bg-layer-3,#fff)}
.sh-eval-score{font-size:32px;line-height:1.15;font-weight:750;margin:4px 0 10px;letter-spacing:-.03em}
.sh-eval-score span{font-size:16px;font-weight:500;color:var(--dsw-alias-label-tertiary,#6b7280)}
.sh-eval-tag{display:inline-block;font-size:12px;line-height:22px;padding:0 10px;border-radius:8px;background:#eff6ff;color:#1d4ed8;margin:0 0 12px}
.sh-eval-sum{font-size:13px;line-height:1.8;color:var(--dsw-alias-label-secondary,#4b5563);margin:0}
.sh-eval-h{font-size:15px;font-weight:650;margin:4px 0 14px}
.sh-eval-item{padding:16px 18px;margin:0 0 12px;border:1px solid var(--dsw-alias-border-l2,#eee);border-radius:12px;background:var(--dsw-alias-bg-layer-3,#fff)}
.sh-eval-h + .sh-eval-item{border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.sh-eval-top{display:flex;align-items:center;gap:10px;margin:0 0 10px}
.sh-eval-ico{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;flex:none}
.sh-eval-name{flex:1;min-width:0;font-size:14px;font-weight:650}
.sh-eval-sc{font-size:14px;font-weight:650;flex:none}
.sh-eval-bar{height:8px;border-radius:99px;background:var(--dsw-alias-bg-module-platform,#f3f4f6);overflow:hidden;margin:0 0 12px}
.sh-eval-bar>span{display:block;height:100%;border-radius:99px}
.sh-eval-why{margin:0;font-size:13px;line-height:1.8;color:var(--dsw-alias-label-tertiary,#6b7280)}
.sh-radar{display:block;margin:4px auto 0;color:var(--dsw-alias-border-l3,#cbd5e1)}
.sh-sec-ico{width:16px;height:16px;flex:none;display:block}
@media (max-width:560px){.sh-eval-hero{grid-template-columns:1fr;justify-items:center;text-align:center}}
.sh-foot{display:flex;gap:8px;justify-content:flex-end;align-items:center;padding:12px 18px;border-top:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-1,#fafafa)}
.sh-mini{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-3,#fff);border-radius:8px;padding:6px 10px;cursor:pointer;font:inherit;font-size:12px;color:var(--dsw-alias-label-primary,inherit);text-decoration:none}
.sh-mini.primary{background:var(--dsw-alias-button-primary-fill,#111827);color:var(--dsw-alias-label-primary-foreground,#fff);border-color:var(--dsw-alias-button-primary-fill,#111827)}
.sh-mini:disabled{opacity:.4;cursor:default}
.sh-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:var(--dsw-alias-toast-bg,#111827);color:#fff;padding:10px 16px;border-radius:999px;font-size:13px;z-index:2147483646}
.sh-err{color:var(--dsw-alias-state-error-primary,#b91c1c);font-size:12px;margin:8px 0}
.sh-tool{margin:4px 0 8px}
.sh-fade{animation:sh-in .18s ease}
.sh-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.sh-row:first-child{border-top:0}
.sh-cfg-item{list-style:none}
.sh-cfg{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-alias-bg-layer-3,#fff);border-radius:12px;box-sizing:border-box}
.sh-cfg.open{background:var(--dsw-alias-bg-layer-2,#fafafa)}
.sh-cfg-h{box-sizing:border-box;width:100%;align-items:center;gap:12px;padding:14px 16px;display:flex}
.sh-cfg-expand{appearance:none;flex:1;min-width:0;font:inherit;color:inherit;text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:12px;padding:0;display:flex}
.sh-cfg-toggle{appearance:none;flex:none;width:28px;height:28px;padding:0;border:0;background:0 0;color:inherit;cursor:pointer;display:grid;place-items:center}
.sh-cfg-t{flex-direction:column;flex:1;gap:4px;min-width:0;display:flex}
.sh-cfg-n{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary,inherit)}
.sh-cfg-d{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:13px;line-height:1.5}
.sh-cfg-ch{color:var(--dsw-alias-label-tertiary,#6b7280);flex:none;width:14px;height:14px;transition:transform .16s;display:block;pointer-events:none}
.sh-cfg.open .sh-cfg-ch{transform:rotate(180deg)}
.sh-cfg-b{border-top:1px solid var(--dsw-alias-border-l2,#e5e7eb);margin:0 16px;padding:8px 0 12px}
.sh-cfg-f{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-top:1px solid var(--dsw-alias-border-l2,#eee)}
.sh-cfg-f:first-child{border-top:0}
.sh-cfg-f label{font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary,inherit)}
.sh-cfg-f input[type=text],.sh-cfg-f input[type=number]{border:1px solid var(--dsw-alias-border-l2,#e5e7eb);background:var(--dsw-specific-input-major,var(--dsw-alias-bg-layer-3,#fff));color:var(--dsw-alias-label-primary,inherit);height:34px;font:inherit;border-radius:8px;padding:0 12px;font-size:13px}
.sh-cfg-hint{margin:0;color:var(--dsw-alias-label-caption,#6b7280);font-size:12px}
.sh-cfg-ft{border-top:1px solid var(--dsw-alias-border-l2,#e5e7eb);justify-content:flex-end;gap:8px;padding:12px 0 4px;display:flex}
.sh-cfg-ft button{appearance:none;font:inherit;cursor:pointer;border-radius:8px;padding:5px 14px;font-size:13px}
.sh-cfg-save{background:var(--dsw-alias-button-primary-fill,#111827);color:var(--dsw-alias-label-primary-foreground,#fff);border:1px solid var(--dsw-alias-button-primary-fill,#111827)}
.sh-cfg-save:disabled,.sh-cfg-disc:disabled{opacity:.4;cursor:default}
.sh-cfg-disc{background:0 0;border:1px solid var(--dsw-alias-border-l2,#d1d5db);color:var(--dsw-alias-label-secondary,#4b5563)}
.sh-cfg-err{color:var(--dsw-alias-state-error-primary,#b91c1c);flex:1;margin:0;font-size:12px}
@keyframes sh-in{from{opacity:0}to{opacity:1}}
.sh-mkt{display:flex;flex-direction:column;gap:14px;width:100%;max-width:760px;padding-bottom:24px;color:var(--dsw-alias-label-primary,#17191c);font-family:var(--dsw-font-family,inherit)}
.sh-mkt *{box-sizing:border-box}
.sh-mkt-filter{flex:none;height:30px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary,#7b8088);font:inherit;font-size:12px;cursor:pointer;white-space:nowrap}
.sh-mkt-search{display:flex;align-items:center;gap:8px}
.sh-mkt-field{position:relative;flex:1;min-width:0;color:var(--dsw-alias-label-tertiary,#7b8088)}
.sh-mkt-field svg{position:absolute;top:10px;left:12px;width:16px;height:16px;pointer-events:none}
.sh-mkt-search input{width:100%;height:36px;border:1px solid var(--dsw-alias-border-l2,#e2e4e8);border-radius:8px;padding:0 12px 0 36px;outline:none;background:var(--dsw-alias-bg-layer-1,#f5f6f8);color:var(--dsw-alias-label-primary,#17191c);font:inherit;font-size:13px}
.sh-mkt-search input::placeholder{color:var(--dsw-alias-label-tertiary,#7b8088)}
.sh-mkt-search input:focus-visible{border-color:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-business-primary,#4d6bfe) 18%,transparent)}
.sh-mkt-go,.sh-mkt-install{border:1px solid transparent;border-radius:8px;background:var(--dsw-alias-label-primary,#17191c);color:var(--dsw-alias-bg-layer-3,#fff);font:inherit;font-weight:600;cursor:pointer}
.sh-mkt-go{flex:none;height:36px;padding:0 16px;font-size:13px}
.sh-mkt-go:hover,.sh-mkt-install:hover:not(:disabled){opacity:.82}
.sh-mkt-filters{display:flex;align-items:center;gap:5px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.sh-mkt-filters::-webkit-scrollbar{display:none}
.sh-mkt-filter:hover{background:var(--dsw-alias-interactive-bg-hover,#f3f4f6)}
.sh-mkt-filter.on{background:var(--dsw-specific-sidebar-nav-item-active,#ebeef2);color:var(--dsw-alias-label-primary,#17191c);font-weight:500}
.sh-mkt-results{display:flex;align-items:baseline;justify-content:flex-start;gap:12px;padding:0 2px}
.sh-mkt-summary{margin:0;color:var(--dsw-alias-label-tertiary,#7b8088);font-size:12px;font-variant-numeric:tabular-nums}
.sh-mkt-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch;gap:10px}
.sh-mkt-card{position:relative;min-width:0;min-height:188px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l2,#e2e4e8);border-radius:10px;padding:14px;background:var(--dsw-alias-bg-layer-3,#fff)}
.sh-mkt-card:hover{border-color:var(--dsw-alias-border-l1,#cfd2d8);box-shadow:var(--dsw-shadow-lv1,0 2px 8px rgb(20 24 32 / 8%))}
.sh-mkt-head{display:flex;align-items:center;gap:10px}
.sh-mkt-head-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px;justify-content:center}
.sh-mkt-avatar{flex:none;width:36px;height:36px;border-radius:9px;object-fit:cover;border:1px solid var(--dsw-alias-border-l2,#e2e4e8);background:linear-gradient(135deg,#c7d2fe,#fbcfe8)}
.sh-mkt-avatar-fallback{display:grid;place-items:center;font-weight:700;font-size:14px;line-height:1;color:#374151}
.sh-mkt-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
.sh-mkt-owner{min-width:0;overflow:hidden;margin:0;color:var(--dsw-alias-label-tertiary,#7b8088);font-family:var(--ds-font-family-code,ui-monospace,monospace);font-size:11px;line-height:14px;text-overflow:ellipsis;white-space:nowrap}
.sh-mkt-badge{flex:none;min-height:18px;display:inline-flex;align-items:center;border-radius:5px;padding:1px 6px;background:var(--dsw-alias-bg-layer-1,#f5f6f8);color:var(--dsw-alias-label-tertiary,#7b8088);font-size:11px;line-height:16px}
.sh-mkt-badge.ok{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#279c62) 10%,transparent);color:var(--dsw-alias-state-success-primary,#279c62)}
.sh-mkt-name{margin:0;overflow-wrap:anywhere;font-size:15px;line-height:18px;font-weight:600}
.sh-mkt-desc{display:-webkit-box;overflow:hidden;margin:10px 0 0;color:var(--dsw-alias-label-tertiary,#7b8088);font-size:12px;line-height:18px;-webkit-box-orient:vertical;-webkit-line-clamp:3}
.sh-mkt-meta{display:flex;justify-content:space-between;gap:10px;margin-top:auto;padding-top:13px;color:var(--dsw-alias-label-tertiary,#7b8088);font-size:11px;line-height:17px}
.sh-mkt-actions{display:flex;align-items:center;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid var(--dsw-alias-border-l2,#e2e4e8)}
.sh-mkt-details{flex:1;color:var(--dsw-alias-label-secondary,#4b5058);font-size:12px;font-weight:500;text-decoration:none;position:relative;z-index:1}
.sh-mkt-install{position:relative;z-index:1;min-height:30px;padding:0 10px;font-size:12px}
.sh-mkt-install:disabled{opacity:.4;cursor:default}
.sh-mkt-status{margin:0;padding:32px 12px;color:var(--dsw-alias-label-tertiary,#7b8088);font-size:13px;line-height:20px;text-align:center}
.sh-mkt-more{align-self:stretch;display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;margin-top:2px;padding:0 16px;border:1px solid var(--dsw-alias-border-l2,#e2e4e8);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#f5f6f8);color:var(--dsw-alias-label-secondary,#4b5058);font:inherit;font-size:13px;font-weight:500;cursor:pointer;transition:background .16s,border-color .16s,box-shadow .16s,color .16s}
.sh-mkt-more:hover{background:var(--dsw-alias-bg-layer-3,#fff);border-color:var(--dsw-alias-border-l1,#cfd2d8);box-shadow:var(--dsw-shadow-lv1,0 2px 8px rgb(20 24 32 / 8%));color:var(--dsw-alias-label-primary,#17191c)}
.sh-mkt-more:active{transform:translateY(0.5px)}
.sh-mkt-more-left{color:var(--dsw-alias-label-tertiary,#7b8088);font-size:12px;font-weight:400;font-variant-numeric:tabular-nums}
.sh-mkt-more svg{flex:none;width:14px;height:14px}
@media (max-width:680px){.sh-mkt-grid{grid-template-columns:minmax(0,1fr)}.sh-mkt-search{align-items:stretch;flex-direction:column}.sh-mkt-go{width:100%}}
.sh-plaza-wrap{width:100%}
.sh-plaza-wrap.rail{display:flex;justify-content:center}
.sh-plaza-trigger{box-sizing:border-box;display:flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:4px -2px;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:14px;line-height:22px;cursor:pointer;overflow:hidden}
.sh-plaza-wrap.rail .sh-plaza-trigger{width:36px;height:36px;margin:8px 0 10px;padding:0;justify-content:center;border-radius:50%;gap:0}
.sh-plaza-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,#f3f4f6)}
.sh-plaza-trigger svg{flex:none;width:16px;height:16px}
.sh-plaza-wrap.rail .sh-plaza-trigger svg{width:18px;height:18px}
.sh-plaza-trigger.on,.sh-plaza-trigger[aria-expanded=true]{background:var(--dsw-specific-sidebar-nav-item-active,#ebeef2)}
.sh-plaza-trigger span{white-space:nowrap;overflow:hidden}
.sh-plaza-page{position:fixed;z-index:40;box-sizing:border-box;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-primary,#17191c)}
.sh-plaza-top{display:flex;align-items:center;gap:16px;flex:none;padding:10px 20px;border-bottom:1px solid var(--dsw-alias-border-l2,#e2e4e8);background:var(--dsw-alias-bg-base,#fff)}
.sh-plaza-tabs{display:flex;align-items:center;gap:16px;padding:0;border:0;background:inherit}
.sh-plaza-tab{height:30px;padding:0;border:0;border-radius:0;background:inherit;color:var(--dsw-alias-label-tertiary,#7b8088);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.sh-plaza-tab:hover{color:var(--dsw-alias-label-primary,#17191c)}
.sh-plaza-tab.on{background:inherit;color:var(--dsw-alias-state-business-primary,#4d6bfe);box-shadow:none}
.sh-plaza-close{margin-left:auto;width:32px;height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#d1d5db);background:var(--dsw-alias-bg-layer-3,#fff);cursor:pointer;font-size:18px;line-height:1;color:var(--dsw-alias-label-secondary,#4b5563)}
.sh-plaza-close:hover{background:var(--dsw-alias-interactive-bg-hover,#f3f4f6)}
.sh-plaza-body{flex:1;min-height:0;overflow:auto;padding:18px 20px 32px}
.sh-plaza-body .sh-mkt{max-width:none;width:100%}
.sh-plaza-body .sh-cards,.sh-plaza-body .sh-mkt-grid{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
@media (max-width:1400px){.sh-plaza-body .sh-cards,.sh-plaza-body .sh-mkt-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:980px){.sh-plaza-body .sh-cards,.sh-plaza-body .sh-mkt-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.sh-plaza-body .sh-cards,.sh-plaza-body .sh-mkt-grid{grid-template-columns:1fr}}
.sh-plaza-body .sh-card{min-height:112px;padding:16px;gap:14px}
.sh-plaza-body .sh-icon{width:48px;height:48px;border-radius:12px;font-size:14px}
.sh-plaza-body .sh-title{font-size:15px;line-height:22px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.sh-plaza-body .sh-desc{-webkit-line-clamp:2;font-size:13px;line-height:20px}
.sh-plaza-body .sh-mkt-card{min-height:220px;padding:16px}
`;

    const CSS_ID = "skillhub-style";
    function ensureCss() {
      if (typeof document === "undefined") return () => {};
      let s = document.getElementById(CSS_ID);
      if (!s) {
        s = document.createElement("style");
        s.id = CSS_ID;
        document.head.appendChild(s);
      }
      s.textContent = CSS;
      return () => {};
    }

    const fallbackPortal = (node) => node;
    let createPortal = fallbackPortal;
    try {
      const rd = require("react-dom");
      if (rd && typeof rd.createPortal === "function") createPortal = rd.createPortal;
    } catch { /* overlay still works without portal */ }

    function initials(name) {
      const t = String(name || "").replace(/[a-zA-Z0-9._-]/g, "");
      return (t.slice(0, 3) || String(name || "SK").slice(0, 2)).toUpperCase();
    }

    function pluginUrl(path) {
      const suffix = String(path || "").replace(/^\/+/, "");
      const base = typeof document !== "undefined" ? document.baseURI : "/";
      return new URL("./skillhub" + (suffix ? "/" + suffix : ""), base).toString();
    }

    function iconSrc(url) {
      if (!url) return "";
      if (url.startsWith("data:")) return url;
      return pluginUrl("icon?url=" + encodeURIComponent(url));
    }

    function fmt(n, tr) {
      const v = Number(n) || 0;
      const en = tr && tr("locale") === "en";
      if (en) {
        if (v >= 1000000) return (v / 1000000).toFixed(v >= 10000000 ? 0 : 1) + "M";
        if (v >= 10000) return (v / 1000).toFixed(v >= 100000 ? 0 : 1) + "k";
        return String(v);
      }
      if (v >= 10000) return (v / 10000).toFixed(v >= 100000 ? 0 : 1) + " 万";
      return String(v);
    }

    function fmtStat(n, tr) {
      if (n == null || n === "") return "…";
      return fmt(n, tr);
    }

    function fmtTime(n, tr) {
      const t = Number(n);
      if (!t) return "";
      const d = new Date(t);
      if (Number.isNaN(d.getTime())) return "";
      const loc = tr && tr("locale") === "en" ? "en-US" : "zh-CN";
      return d.toLocaleDateString(loc, { year: "numeric", month: "short", day: "numeric" });
    }

    const ZH = {
      locale: "zh",
      "cfg.desc": "搜索 API、安装目录与结果数量。",
      "cfg.updateHint": "当前 {cur} · 最新 {latest}",
      "cfg.unsaved": "未保存",
      "cfg.collapse": "收起",
      "cfg.expand": "展开",
      "cfg.api": "API 地址",
      "cfg.dir": "安装目录",
      "cfg.max": "搜索结果上限",
      "cfg.discard": "放弃修改",
      "cfg.save": "保存",
      "cfg.saving": "保存中",
      "installed.hint": "已安装 {n} 个技能",
      "installed.none": "还没有安装技能",
      "action.detail": "详情",
      "action.uninstall": "卸载",
      "action.uninstalling": "卸载中",
      "action.install": "一键安装",
      "action.installing": "安装中",
      "action.installed": "已安装",
      "action.openHome": "打开主页",
      "action.close": "关闭",
      "badge.installed": "已装",
      "search.hint": "点击卡片查看详情并安装 · {n} 条",
      "search.empty": "没有结果",
      "tab.overview": "概述",
      "tab.versions": "版本历史",
      "tab.evaluation": "评测报告",
      "stat.downloads": "下载",
      "stat.stars": "收藏",
      "stat.installs": "安装",
      "meta.downloads": "{n} 下载",
      "grade.excellent": "优秀",
      "grade.good": "良好",
      "grade.fair": "一般",
      "grade.poor": "待提升",
      "rate.ai": "AI 评分",
      "verified": "认证",
      "verified.account": "认证账号",
      "eval.none": "该 Skill 暂未进行评测",
      "eval.grade": "综合评级：{g}",
      "eval.detail": "评测详情",
      "dim.trust": "可信任度",
      "dim.reliability": "可靠性",
      "dim.adaptability": "适用性",
      "dim.convention": "规范性",
      "dim.effectiveness": "有效性",
      "ver.none": "暂无版本历史",
      "ver.latest": "最新",
      "ver.current": "当前已装",
      "ver.unknownDate": "发布日期未知",
      "ver.noLog": "无更新说明",
      "ver.this": "已安装此版本",
      "ver.install": "安装指定版本",
      "overview.empty": "暂无简介",
      "sec.badge": "安全",
      loading: "加载中…",
      "toast.installed": "✅ {name} 已安装",
      "toast.uninstalled": "已卸载 {name}",
      "cat.office-efficiency": "办公效率",
      "cat.content-creation": "内容创作",
      "cat.dev-programming": "开发编程",
      "cat.data-analysis": "数据分析",
      "cat.design-media": "设计多媒体",
      "cat.ai-agent": "AI Agent",
      "cat.knowledge-management": "知识管理",
      "cat.business-ops": "商业运营",
      "cat.education": "教育学习",
      "cat.professional": "行业专业",
      "cat.it-ops-security": "IT 运维与安全",
      "cat.life-service": "生活服务",
      "mkt.searchPlaceholder": "输入关键词",
      "mkt.search": "搜索",
      "mkt.repos": "发现 GitHub MIT 开源的共 {n} 个 DeepSeek Harness Plugin",
      "mkt.loading": "正在读取 SkillHub",
      "mkt.error": "连接失败：{m}",
      "mkt.empty": "没有匹配的插件。",
      "mkt.noDesc": "这个仓库还没有填写简介。",
      "mkt.details": "详情",
      "mkt.verified": "已验证",
      "mkt.unsupported": "不可直接安装",
      "mkt.sending": "正在发送",
      "mkt.install": "安装",
      "mkt.sent": "已把 {name} 的审核安装请求发送给当前 DSH 任务。",
      "mkt.noTask": "请先打开一个 DSH 任务",
      "mkt.unavailableTask": "当前 DSH 任务不可用",
      "mkt.more": "加载更多",
      "mkt.moreLeft": "还剩 {n} 个",
      "mkt.catAll": "全部",
      "plaza.title": "插件广场",
      "plaza.skills": "技能",
      "plaza.plugins": "插件",
      "plaza.noSession": "请先打开一个会话",
      "plaza.back": "返回对话",
    };
    const EN = {
      locale: "en",
      "cfg.desc": "Search API, install directory, and result count.",
      "cfg.updateHint": "Current {cur} · Latest {latest}",
      "cfg.unsaved": "Unsaved",
      "cfg.collapse": "Collapse",
      "cfg.expand": "Expand",
      "cfg.api": "API URL",
      "cfg.dir": "Install directory",
      "cfg.max": "Search result limit",
      "cfg.discard": "Discard",
      "cfg.save": "Save",
      "cfg.saving": "Saving",
      "installed.hint": "{n} skills installed",
      "installed.none": "No skills installed",
      "action.detail": "Details",
      "action.uninstall": "Uninstall",
      "action.uninstalling": "Uninstalling",
      "action.install": "Install",
      "action.installing": "Installing",
      "action.installed": "Installed",
      "action.openHome": "Open homepage",
      "action.close": "Close",
      "badge.installed": "On",
      "search.hint": "Click a card to view details and install · {n}",
      "search.empty": "No results",
      "tab.overview": "Overview",
      "tab.versions": "Versions",
      "tab.evaluation": "Evaluation",
      "stat.downloads": "Downloads",
      "stat.stars": "Stars",
      "stat.installs": "Installs",
      "meta.downloads": "{n} downloads",
      "grade.excellent": "Excellent",
      "grade.good": "Good",
      "grade.fair": "Fair",
      "grade.poor": "Needs work",
      "rate.ai": "AI rating",
      "verified": "Verified",
      "verified.account": "Verified publisher",
      "eval.none": "This skill has not been evaluated yet",
      "eval.grade": "Overall: {g}",
      "eval.detail": "Evaluation details",
      "dim.trust": "Trust",
      "dim.reliability": "Reliability",
      "dim.adaptability": "Adaptability",
      "dim.convention": "Convention",
      "dim.effectiveness": "Effectiveness",
      "ver.none": "No version history",
      "ver.latest": "Latest",
      "ver.current": "Installed",
      "ver.unknownDate": "Unknown date",
      "ver.noLog": "No changelog",
      "ver.this": "This version installed",
      "ver.install": "Install this version",
      "overview.empty": "No description",
      "sec.badge": "Safe",
      loading: "Loading…",
      "toast.installed": "✅ {name} installed",
      "toast.uninstalled": "Uninstalled {name}",
      "cat.office-efficiency": "Office",
      "cat.content-creation": "Content",
      "cat.dev-programming": "Programming",
      "cat.data-analysis": "Data",
      "cat.design-media": "Design",
      "cat.ai-agent": "AI Agent",
      "cat.knowledge-management": "Knowledge",
      "cat.business-ops": "Business",
      "cat.education": "Education",
      "cat.professional": "Professional",
      "cat.it-ops-security": "IT & Security",
      "cat.life-service": "Lifestyle",
      "mkt.searchPlaceholder": "Enter keywords",
      "mkt.search": "Search",
      "mkt.repos": "Found {n} MIT-licensed open-source DeepSeek Harness plugins on GitHub",
      "mkt.loading": "Loading SkillHub",
      "mkt.error": "Connection failed: {m}",
      "mkt.empty": "No plugins match your filters.",
      "mkt.noDesc": "This repository has no description yet.",
      "mkt.details": "Details",
      "mkt.verified": "Verified",
      "mkt.unsupported": "Direct install unavailable",
      "mkt.sending": "Sending",
      "mkt.install": "Install",
      "mkt.sent": "Sent the review-first install request for {name} to the current DSH task.",
      "mkt.noTask": "Open a DSH task before installing",
      "mkt.unavailableTask": "The current DSH task is unavailable",
      "mkt.more": "Load more",
      "mkt.moreLeft": "{n} remaining",
      "mkt.catAll": "All",
      "plaza.title": "Plugin Plaza",
      "plaza.skills": "Skills",
      "plaza.plugins": "Plugins",
      "plaza.noSession": "Open a session first",
      "plaza.back": "Back to chat",
    };

    const I18nCtx = React.createContext(null);

    function interpolate(template, params) {
      if (!params) return template;
      return String(template).replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
    }

    function browserLang() {
      const lang = (typeof document !== "undefined" && document.documentElement.lang)
        || (typeof navigator !== "undefined" && navigator.language)
        || "zh";
      return /^en\b/i.test(String(lang)) ? "en" : "zh";
    }

    function lookup(key, params) {
      const dict = browserLang() === "en" ? EN : ZH;
      return interpolate(dict[key] || ZH[key] || key, params);
    }

    function useTr() {
      return React.useContext(I18nCtx) || lookup;
    }

    function I18nProvider({ t, children }) {
      const fn = typeof t === "function" ? t : lookup;
      return h(I18nCtx.Provider, { value: fn }, children);
    }

    function catLabel(item, tr) {
      const key = item && item.category ? "cat." + item.category : "";
      const label = key ? tr(key) : "";
      if (label && label !== key) return label;
      return (item && (item.categoryLabel || item.category)) || "";
    }

    const DETAIL_TABS = [
      { id: "overview", labelKey: "tab.overview" },
      { id: "versions", labelKey: "tab.versions" },
      { id: "evaluation", labelKey: "tab.evaluation" },
    ];
    const TRACE = [
      ["trust", "T", "Trust", "可信任度", "#16a34a"],
      ["reliability", "R", "Reliability", "可靠性", "#2563eb"],
      ["adaptability", "A", "Adaptability", "适用性", "#d97706"],
      ["convention", "C", "Convention", "规范性", "#7c3aed"],
      ["effectiveness", "E", "Effectiveness", "有效性", "#ea580c"],
    ];

    async function api(method, payload) {
      const res = await fetch(pluginUrl(""), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, ...payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) throw new Error(body.error || "HTTP " + res.status);
      return body;
    }

    function Toast({ text, onDone }) {
      useEffect(() => {
        const t = setTimeout(onDone, 1600);
        return () => clearTimeout(t);
      }, [text, onDone]);
      return h("div", { className: "sh-toast" }, text);
    }

    function Icon({ item, className }) {
      const src = iconSrc(item.iconUrl);
      if (src) return h("img", { className, src, alt: "" });
      return h("div", { className }, initials(item.name || item.slug));
    }

    function Cards({ items, onOpen }) {
      const tr = useTr();
      if (!items?.length) return h("div", { className: "sh-hint" }, tr("search.empty"));
      return h(
        "div",
        { className: "sh-cards" },
        items.map((item) => {
          const meta = [
            catLabel(item, tr),
            item.downloads ? tr("meta.downloads", { n: fmt(item.downloads, tr) }) : null,
            item.version ? "v" + item.version : null,
          ].filter(Boolean).join(" · ");
          return h(
            "button",
            {
              key: item.slug || item.id,
              type: "button",
              className: "sh-card" + (item.installed ? " on" : ""),
              onClick: () => onOpen(item),
            },
            h(Icon, { item, className: "sh-icon" }),
            h("div", { className: "sh-meta" },
              h("div", { className: "sh-top" },
                h("div", { className: "sh-title", title: item.name }, item.name),
                item.installed ? h("span", { className: "sh-badge" }, tr("badge.installed")) : null,
              ),
              item.description ? h("div", { className: "sh-desc" }, item.description) : null,
              h("div", { className: "sh-footline" }, meta || item.slug),
            ),
          );
        }),
      );
    }

    function TabBar({ tab, onChange }) {
      const tr = useTr();
      return h("div", { className: "sh-tabs", role: "tablist" },
        DETAIL_TABS.map((it) => h("button", {
          key: it.id,
          type: "button",
          role: "tab",
          className: "sh-tab" + (tab === it.id ? " on" : ""),
          "aria-selected": tab === it.id,
          onClick: () => onChange(it.id),
        }, tr(it.labelKey))),
      );
    }

    function normVer(v) {
      return String(v || "").trim().replace(/^v/i, "");
    }

    function VersionsPane({ data, currentVersion, installed, busy, onInstall }) {
      const tr = useTr();
      const items = data?.versions || [];
      if (!items.length) return h("p", { className: "sh-hint" }, tr("ver.none"));
      return h("div", null, items.map((v, idx) => {
        const ver = normVer(v.version);
        const current = !!installed && !!ver && normVer(currentVersion) === ver;
        return h("div", { key: ver || idx, className: "sh-ver-card" },
          h("div", { className: "sh-ver-main" },
            h("div", { className: "sh-ver-head" },
              h("b", null, "v" + ver),
              idx === 0 ? h("span", { className: "sh-tag blue" }, tr("ver.latest")) : null,
              current ? h("span", { className: "sh-tag green" }, tr("ver.current")) : null,
            ),
            h("div", { className: "sh-hint", style: { margin: 0 } }, fmtTime(v.createdAt, tr) || tr("ver.unknownDate")),
            h("p", { className: "sh-ver-log" }, v.changelog || tr("ver.noLog")),
          ),
          h("button", {
            type: "button",
            className: "sh-mini" + (current ? "" : " primary"),
            disabled: !!busy || current || !ver,
            onClick: () => onInstall(ver),
          }, current ? tr("ver.this") : (busy === ver ? tr("action.installing") : tr("ver.install"))),
        );
      }));
    }

    function radarPoints(values, cx, cy, r) {
      return values.map((v, i) => {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
        const rr = r * Math.max(0, Math.min(1, Number(v) / 5));
        return (cx + Math.cos(a) * rr).toFixed(1) + "," + (cy + Math.sin(a) * rr).toFixed(1);
      }).join(" ");
    }

    function DimIcon({ letter, color }) {
      const svg = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
      if (letter === "T") return h("svg", svg, h("path", { d: "M12 3l8 4v5c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V7l8-4z" }));
      if (letter === "R") return h("svg", svg, h("path", { d: "M12 21V3M5 10l7-7 7 7" }));
      if (letter === "A") return h("svg", svg, h("circle", { cx: 12, cy: 12, r: 8 }), h("path", { d: "M12 8v8M8 12h8" }));
      if (letter === "C") return h("svg", svg, h("path", { d: "M5 4h11a3 3 0 010 6H5z" }), h("path", { d: "M5 10h12a3 3 0 010 6H8" }));
      return h("svg", svg, h("path", { d: "M13 3L5 14h7l-1 7 8-11h-7l1-7z" }));
    }

    function RadarChart({ scores }) {
      const cx = 90;
      const cy = 90;
      const r = 58;
      const full = TRACE.map(() => 5);
      return h("svg", { className: "sh-radar", viewBox: "0 0 180 180", width: 180, height: 180, "aria-hidden": "true" },
        [1, 2, 3, 4, 5].map((level) => h("polygon", {
          key: level,
          points: radarPoints(full.map(() => level), cx, cy, r),
          fill: "none",
          stroke: "currentColor",
          strokeWidth: 1,
        })),
        TRACE.map((d, i) => {
          const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
          return h("line", {
            key: d[0],
            x1: cx,
            y1: cy,
            x2: +(cx + Math.cos(a) * r).toFixed(1),
            y2: +(cy + Math.sin(a) * r).toFixed(1),
            stroke: "currentColor",
            strokeWidth: 1,
          });
        }),
        h("polygon", {
          points: radarPoints(scores, cx, cy, r),
          fill: "rgba(37,99,235,.16)",
          stroke: "#2563eb",
          strokeWidth: 1.6,
        }),
        TRACE.map((d, i) => {
          const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
          return h("text", {
            key: "l" + d[0],
            x: +(cx + Math.cos(a) * (r + 16)).toFixed(1),
            y: +(cy + Math.sin(a) * (r + 16)).toFixed(1),
            textAnchor: "middle",
            dominantBaseline: "middle",
            fontSize: 12,
            fontWeight: 700,
            fill: d[4],
          }, d[1]);
        }),
      );
    }

    function evalGrade(score, tr) {
      const n = Number(score);
      if (!Number.isFinite(n)) return "";
      const tx = tr || lookup;
      if (n >= 4.5) return tx("grade.excellent");
      if (n >= 4) return tx("grade.good");
      if (n >= 3) return tx("grade.fair");
      return tx("grade.poor");
    }

    function starText(score) {
      const n = Math.max(0, Math.min(5, Math.round(Number(score) || 0)));
      return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
    }

    function isSafeItem(item) {
      const reports = [item?.security?.keen, item?.security?.sanbu].filter(Boolean);
      if (reports.some((r) => r.status === "malicious" || r.status === "suspicious")) return false;
      if (reports.some((r) => r.status === "benign")) return true;
      return !!(item?.integrity?.signed || item?.integrity?.contentHash);
    }

    function Marks({ item, detail }) {
      const tr = useTr();
      const grade = evalGrade(item.rating, tr);
      const rate = item.rating != null && Number.isFinite(Number(item.rating));
      const bluev = detail && item.verified;
      const safe = detail && isSafeItem(item);
      if (!rate && !bluev && !safe) return null;
      return h("div", { className: "sh-marks" },
        rate ? h("span", { className: "sh-rate", title: tr("rate.ai") },
          h("span", { className: "sh-stars", "aria-hidden": "true" }, starText(item.rating)),
          Number(item.rating).toFixed(1),
          grade ? " " + grade : "",
          detail ? " (" + tr("rate.ai") + ")" : "",
        ) : null,
        bluev ? h("span", { className: "sh-bluev", title: item.publisherName || tr("verified.account") },
          h("i", { "aria-hidden": "true" }, "v"),
          h("span", null, item.publisherName || tr("verified")),
        ) : null,
        safe ? h("span", { className: "sh-safe", title: tr("sec.badge") },
          h(ShieldIcon),
          tr("sec.badge"),
        ) : null,
      );
    }

    function ShieldIcon() {
      return h("svg", { className: "sh-sec-ico", viewBox: "0 0 20 20", fill: "none", "aria-hidden": "true" },
        h("path", {
          d: "M3.15 2.35 10 .83l6.85 1.52c.38.09.65.42.65.82v8.32c0 1.67-.84 3.23-2.23 4.16L10 19.17l-5.27-3.52C3.34 14.72 2.5 13.16 2.5 11.49V3.17c0-.39.27-.73.65-.82Zm7.68 5.98V4.17L6.67 10h2.5v4.17L13.33 8.33H10.83Z",
          fill: "url(#shShield)",
        }),
        h("defs", null,
          h("linearGradient", { id: "shShield", x1: "10", y1: "0.83", x2: "10", y2: "19.17", gradientUnits: "userSpaceOnUse" },
            h("stop", { stopColor: "#A6E527" }),
            h("stop", { offset: "1", stopColor: "#0CBF5B" }),
          ),
        ),
      );
    }

    function EvaluationPane({ data }) {
      const tr = useTr();
      const ev = data?.evaluation;
      if (!ev) return h("p", { className: "sh-hint" }, tr("eval.none"));
      const scores = TRACE.map((d) => Number(ev.dimensions?.[d[0]]?.score) || 0);
      const grade = evalGrade(ev.score, tr);
      return h("div", null,
        h("div", { className: "sh-eval-hero" },
          h(RadarChart, { scores }),
          h("div", null,
            h("div", { className: "sh-eval-score" }, (ev.score != null ? ev.score : "-"), h("span", null, " / 5")),
            grade ? h("div", { className: "sh-eval-tag" }, tr("eval.grade", { g: grade })) : null,
            ev.userSummary ? h("p", { className: "sh-eval-sum" }, ev.userSummary) : null,
          ),
        ),
        h("div", { className: "sh-eval-h" }, tr("eval.detail")),
        TRACE.map((d) => {
          const dim = ev.dimensions?.[d[0]];
          const score = dim?.score;
          const tint = d[4] + "22";
          return h("div", { key: d[0], className: "sh-eval-item" },
            h("div", { className: "sh-eval-top" },
              h("div", { className: "sh-eval-ico", style: { background: tint } }, h(DimIcon, { letter: d[1], color: d[4] })),
              h("div", { className: "sh-eval-name" }, d[1] + " · " + d[2] + " " + tr("dim." + d[0])),
              h("div", { className: "sh-eval-sc" }, (score == null ? "-" : score) + " / 5"),
            ),
            h("div", { className: "sh-eval-bar" }, h("span", { style: { width: ((Number(score) || 0) / 5 * 100) + "%", background: d[4] } })),
            dim?.userReason ? h("p", { className: "sh-eval-why" }, dim.userReason) : null,
          );
        }),
      );
    }

    function DetailCard({ item, busy, onClose, onInstalled, onUninstalled }) {
      const tr = useTr();
      const [toast, setToast] = useState("");
      const [working, setWorking] = useState("");
      const [tab, setTab] = useState("overview");
      const [view, setView] = useState(item);
      const [pane, setPane] = useState({ loading: false, error: "", data: null });
      const cacheRef = React.useRef({});
      const installed = !!view.installed;
      useEffect(() => { setView(item); }, [item]);
      const applyDetail = (d) => {
        if (!d) return;
        const card = d.card && typeof d.card === "object" ? d.card : null;
        setView((cur) => ({
          ...cur,
          ...(card || {}),
          slug: item.slug,
          installed: d.installed ?? cur.installed,
          version: d.version || card?.version || cur.version,
          pageUrl: card?.pageUrl || cur.pageUrl,
          rating: card?.rating ?? cur.rating,
          verified: card?.verified ?? cur.verified,
          publisherName: card?.publisherName || cur.publisherName,
          description: card?.description || cur.description,
          security: card?.security || cur.security,
          integrity: card?.integrity || cur.integrity,
        }));
      };
      useEffect(() => {
        let live = true;
        api("detail", { slug: item.slug })
          .then((d) => { if (live) applyDetail(d); })
          .catch(() => {});
        return () => { live = false; };
      }, [item.slug]);
      useEffect(() => {
        if (tab === "overview") return;
        const cached = cacheRef.current[tab];
        if (cached) {
          setPane({ loading: false, error: "", data: cached });
          return;
        }
        let live = true;
        setPane({ loading: true, error: "", data: null });
        api("skillTab", { slug: item.slug, tab })
          .then((d) => {
            if (!live) return;
            cacheRef.current[tab] = d;
            setPane({ loading: false, error: "", data: d });
          })
          .catch((e) => {
            if (!live) return;
            setPane({ loading: false, error: e.message || String(e), data: null });
          });
        return () => { live = false; };
      }, [item.slug, tab]);
      const run = async (method, extra) => {
        const ver = extra && extra.version;
        setWorking(ver || method);
        try {
          const result = await api(method, { slug: item.slug, ...(extra || {}) });
          if (method === "install") {
            item.installed = true;
            if (result.version) item.version = result.version;
            else if (ver) item.version = ver;
            setView((cur) => ({ ...cur, installed: true, version: item.version || cur.version }));
            onInstalled?.(item);
            const shown = (view.name || item.name) + (item.version ? " v" + String(item.version).replace(/^v/i, "") : "");
            setToast(tr("toast.installed", { name: shown }));
            api("detail", { slug: item.slug }).then(applyDetail).catch(() => {});
          } else {
            item.installed = false;
            setView((cur) => ({ ...cur, installed: false }));
            onUninstalled?.(item);
            setToast(tr("toast.uninstalled", { name: view.name || item.name }));
          }
        } catch (e) {
          setToast(e.message || String(e));
        } finally {
          setWorking("");
        }
      };
      return h("div", { className: "sh-drawer sh-skill sh-fade", role: "dialog", "aria-modal": "true" },
        h("button", { type: "button", className: "sh-close", onClick: onClose, "aria-label": tr("action.close") }, "×"),
        h("div", { className: "sh-head" },
          h(Icon, { item: view, className: "sh-dicon" }),
          h("div", { style: { minWidth: 0, flex: 1 } },
            h("h2", null, view.name),
            view.id ? h("div", { className: "sh-canon" }, view.id) : null,
            h(Marks, { item: view, detail: true }),
            h("div", { className: "sh-tags" },
              catLabel(view, tr) ? h("span", { className: "sh-tag blue" }, catLabel(view, tr)) : null,
              view.version ? h("span", { className: "sh-tag" }, "v" + view.version) : null,
              installed ? h("span", { className: "sh-tag green" }, tr("action.installed")) : null,
            ),
          ),
        ),
        h("div", { className: "sh-body" },
          h("div", { className: "sh-stats" },
            h("div", { className: "sh-stat" }, tr("stat.downloads") + " ", h("b", null, fmtStat(view.downloads, tr))),
            h("div", { className: "sh-stat" }, tr("stat.stars") + " ", h("b", null, fmtStat(view.stars, tr))),
            h("div", { className: "sh-stat" }, tr("stat.installs") + " ", h("b", null, fmtStat(view.installs, tr))),
          ),
          h(TabBar, { tab, onChange: setTab }),
          h("div", { className: "sh-pane" },
            tab === "overview" ? h("p", { className: "sh-overview" }, view.description || tr("overview.empty")) : null,
            tab !== "overview" && pane.loading ? h("p", { className: "sh-hint" }, tr("loading")) : null,
            tab !== "overview" && pane.error ? h("p", { className: "sh-err" }, pane.error) : null,
            tab === "versions" && pane.data ? h(VersionsPane, {
              data: pane.data,
              currentVersion: view.version,
              installed,
              busy: working,
              onInstall: (version) => run("install", { version }),
            }) : null,
            tab === "evaluation" && pane.data ? h(EvaluationPane, { data: pane.data }) : null,
          ),
        ),
        h("div", { className: "sh-foot" },
          view.pageUrl ? h("a", { className: "sh-mini", href: view.pageUrl, target: "_blank", rel: "noreferrer" }, tr("action.openHome")) : null,
          installed ? h("button", { type: "button", className: "sh-mini", disabled: !!working || busy, onClick: () => run("uninstall") }, working === "uninstall" ? tr("action.uninstalling") : tr("action.uninstall")) : null,
          h("button", {
            type: "button",
            className: "sh-mini primary",
            disabled: installed || !!working || busy,
            onClick: () => run("install"),
          }, installed ? tr("action.installed") : (working && working !== "uninstall" ? tr("action.installing") : tr("action.install"))),
        ),
        toast ? h(Toast, { text: toast, onDone: () => setToast("") }) : null,
      );
    }

    const overlayStack = [];
    function Overlay({ children, onClose }) {
      useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        overlayStack.push(onClose);
        const onKey = (e) => {
          if (e.key !== "Escape") return;
          if (overlayStack[overlayStack.length - 1] !== onClose) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => {
          const i = overlayStack.lastIndexOf(onClose);
          if (i >= 0) overlayStack.splice(i, 1);
          document.body.style.overflow = overlayStack.length ? "hidden" : prev;
          window.removeEventListener("keydown", onKey);
        };
      }, [onClose]);
      const portaled = createPortal !== fallbackPortal;
      const hostRef = React.useRef(null);
      useEffect(() => {
        if (portaled) return;
        const el = hostRef.current;
        if (!el) return;
        document.body.appendChild(el);
        return () => { el.remove(); };
      }, [portaled]);
      const overlay = h("div", { ref: portaled ? undefined : hostRef, className: "sh-overlay", onClick: (e) => { if (e.target === e.currentTarget) onClose(); } }, children);
      return portaled && typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
    }

    function Drawer({ item, onClose, onInstalled, onUninstalled }) {
      return h(Overlay, { onClose },
        h(DetailCard, { item, onClose, onInstalled, onUninstalled }),
      );
    }

    function parseToolArgs(props) {
      const block = props?.block;
      const raw = (block && "kind" in block ? block.call?.argsRaw : block?.argsRaw) || "";
      if (!raw || typeof raw !== "string") return {};
      try { return JSON.parse(raw); } catch { return {}; }
    }

    function contentText(node) {
      if (!node) return "";
      if (typeof node === "string") return node;
      if (Array.isArray(node)) return node.map(contentText).join("\n");
      if (typeof node === "object") {
        if (typeof node.text === "string") return node.text;
        if (node.content) return contentText(node.content);
      }
      return "";
    }

    function pickPayload(props) {
      const found = [];
      const visit = (node, depth) => {
        if (!node || depth > 6) return;
        if (typeof node === "string") {
          const t = node.trim();
          if ((t.startsWith("{") || t.startsWith("[")) && t.length > 8) {
            try { visit(JSON.parse(t), depth + 1); } catch { /* ignore */ }
          }
          return;
        }
        if (typeof node !== "object") return;
        if (Array.isArray(node)) {
          for (const x of node) visit(x, depth + 1);
          return;
        }
        if (Array.isArray(node.items)) found.push(node);
        for (const key of ["block", "meta", "result", "resultView", "view", "data", "value", "payload", "content", "message"]) {
          if (node[key] != null) visit(node[key], depth + 1);
        }
      };
      visit(props, 0);
      const block = props?.block;
      visit(block?.meta, 1);
      visit(block?.content, 1);
      visit(block?.resultView, 1);
      visit(contentText(block?.content), 1);
      return found.find((x) => Array.isArray(x.items) && x.items.length) || found[0] || null;
    }

    function SearchToolView(props) {
      useEffect(() => ensureCss(), []);
      const payload = pickPayload(props);
      const args = parseToolArgs(props);
      const query = String(payload?.query || args.query || "").trim();
      const fromTool = Array.isArray(payload?.items) && payload.items.length ? payload.items : null;
      const running = !!(props?.block && !("kind" in props.block));
      const [items, setItems] = useState(fromTool || []);
      const [err, setErr] = useState("");
      const [open, setOpen] = useState(null);
      useEffect(() => {
        if (fromTool) setItems(fromTool);
      }, [fromTool]);
      useEffect(() => {
        if (fromTool || running) return;
        let live = true;
        api("search", { query, queries: args.queries, category: args.category, offset: args.offset, limit: args.limit })
          .then((d) => { if (live) setItems(d.items || []); })
          .catch((e) => { if (live) { setItems([]); setErr(e.message || String(e)); } });
        return () => { live = false; };
      }, [query, running, !!fromTool]);
      if (running || !items.length) return err ? h("div", { className: "sh-err" }, err) : null;
      const mark = (item, installed) => {
        setItems((cur) => cur.map((it) => it.slug === item.slug ? { ...it, installed } : it));
        setOpen((cur) => cur && cur.slug === item.slug ? { ...cur, installed } : cur);
      };
      const tr = typeof props.t === "function" ? props.t : lookup;
      return h(I18nProvider, { t: tr },
        h("div", { className: "sh-root sh-tool" },
          h("div", { className: "sh-hint" }, tr("search.hint", { n: items.length })),
          h(Cards, { items, onOpen: setOpen }),
          open ? h(Drawer, {
            item: open,
            onClose: () => setOpen(null),
            onInstalled: (it) => mark(it, true),
            onUninstalled: (it) => mark(it, false),
          }) : null,
        ),
      );
    }

    function ListToolView(props) {
      useEffect(() => ensureCss(), []);
      const payload = pickPayload(props);
      const fromTool = Array.isArray(payload?.items) ? payload.items : null;
      const running = !!(props?.block && !("kind" in props.block));
      const [items, setItems] = useState(fromTool || []);
      const [open, setOpen] = useState(null);
      const [toast, setToast] = useState("");
      useEffect(() => { if (fromTool) setItems(fromTool); }, [fromTool]);
      if (running) return null;
      const tr = typeof props.t === "function" ? props.t : lookup;
      const openItem = (it) => setOpen({
        slug: it.slug,
        name: it.name,
        description: it.description,
        version: it.version,
        installed: true,
        pageUrl: "https://skillhub.cn/skills/" + it.slug,
      });
      return h(I18nProvider, { t: tr },
        h("div", { className: "sh-root sh-tool" },
          h("div", { className: "sh-hint" }, items.length ? tr("installed.hint", { n: items.length }) : tr("installed.none")),
          items.map((it) => h("div", { key: it.slug, className: "sh-row" },
            h("div", null,
              h("div", { className: "sh-title" }, it.name),
              h("div", { className: "sh-slug" }, it.slug + (it.version ? " · v" + it.version : "")),
            ),
            h("div", null,
              h("button", { type: "button", className: "sh-mini", onClick: () => openItem(it) }, tr("action.detail")),
              h("button", {
                type: "button",
                className: "sh-mini",
                onClick: async () => {
                  try {
                    await api("uninstall", { slug: it.slug });
                    setItems((cur) => cur.filter((x) => x.slug !== it.slug));
                    setToast(tr("toast.uninstalled", { name: it.name }));
                  } catch (e) {
                    setToast(e.message || String(e));
                  }
                },
              }, tr("action.uninstall")),
            ),
          )),
          open ? h(Drawer, {
            item: open,
            onClose: () => setOpen(null),
            onUninstalled: (it) => setItems((cur) => cur.filter((x) => x.slug !== it.slug)),
          }) : null,
          toast ? h(Toast, { text: toast, onDone: () => setToast("") }) : null,
        ),
      );
    }

    function ChevronDown({ className }) {
      return h("svg", {
        className,
        width: 14,
        height: 14,
        viewBox: "0 0 14 14",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        "aria-hidden": "true",
      }, h("path", {
        d: "M11.8486 5.5L11.4238 5.92383L8.69727 8.65137C8.44157 8.90706 8.21562 9.13382 8.01172 9.29785C7.79912 9.46883 7.55595 9.61756 7.25 9.66602C7.08435 9.69222 6.91565 9.69222 6.75 9.66602C6.44405 9.61756 6.20088 9.46883 5.98828 9.29785C5.78438 9.13382 5.55843 8.90706 5.30273 8.65137L2.57617 5.92383L2.15137 5.5L3 4.65137L3.42383 5.07617L6.15137 7.80273C6.42595 8.07732 6.59876 8.24849 6.74023 8.3623C6.87291 8.46904 6.92272 8.47813 6.9375 8.48047C6.97895 8.48703 7.02105 8.48703 7.0625 8.48047C7.07728 8.47813 7.12709 8.46904 7.25977 8.3623C7.40124 8.24849 7.57405 8.07732 7.84863 7.80273L10.5762 5.07617L11 4.65137L11.8486 5.5Z",
        fill: "currentColor",
      }));
    }

    function emptyDraft() {
      return {
        apiBase: "https://api.skillhub.cn",
        skillsDir: "",
        maxResults: 12,
        timeoutMs: 20000,
        sortBy: "score",
      };
    }

    function ConfigCard(props) {
      useEffect(() => ensureCss(), []);
      const tr = typeof props.t === "function" ? props.t : lookup;
      const [open, setOpen] = useState(false);
      const [saved, setSaved] = useState(emptyDraft);
      const [draft, setDraft] = useState(emptyDraft);
      const [saving, setSaving] = useState(false);
      const [updateInfo, setUpdateInfo] = useState(null);
      const [err, setErr] = useState("");
      useEffect(() => {
        let live = true;
        api("config", {})
          .then((d) => {
            if (!live) return;
            const next = {
              apiBase: d.apiBase || "https://api.skillhub.cn",
              skillsDir: d.skillsDir || "",
              maxResults: d.maxResults || 12,
              timeoutMs: d.timeoutMs || 20000,
              sortBy: d.sortBy || "score",
            };
            setSaved(next);
            setDraft(next);
          })
          .catch((e) => { if (live) setErr(e.message || String(e)); });
        api("updateCheck", {})
          .then((d) => { if (live) setUpdateInfo(d); })
          .catch(() => {});
        return () => { live = false; };
      }, []);
      const dirty = !!(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
      const save = async () => {
        if (!draft) return;
        setSaving(true);
        setErr("");
        try {
          const d = await api("config", { save: true, ...draft });
          const next = {
            apiBase: d.apiBase,
            skillsDir: d.skillsDir,
            maxResults: d.maxResults,
            timeoutMs: d.timeoutMs,
            sortBy: d.sortBy,
          };
          setSaved(next);
          setDraft(next);
        } catch (e) {
          setErr(e.message || String(e));
        } finally {
          setSaving(false);
        }
      };
      const versionHint = updateInfo?.latest
        ? tr("cfg.updateHint", { cur: updateInfo.currentVersion || "-", latest: updateInfo.latest.version || "-" })
        : "";
      return h(I18nProvider, { t: tr },
        h("li", { className: "sh-cfg-item" },
        h("div", { className: "sh-cfg" + (open ? " open" : "") },
          h("div", { className: "sh-cfg-h" },
            h("button", {
              type: "button",
              className: "sh-cfg-expand",
              "aria-expanded": open,
              onClick: () => setOpen((v) => !v),
            },
              h("span", { className: "sh-cfg-t" },
                h("span", { className: "sh-cfg-n" }, "SkillHub"),
                h("span", { className: "sh-cfg-d" }, versionHint || tr("cfg.desc")),
              ),
              dirty ? h("span", { className: "sh-tag orange" }, tr("cfg.unsaved")) : null,
            ),
            h("button", {
              type: "button",
              className: "sh-cfg-toggle",
              "aria-label": open ? tr("cfg.collapse") : tr("cfg.expand"),
              onClick: () => setOpen((v) => !v),
            }, h(ChevronDown, { className: "sh-cfg-ch" })),
          ),
          open ? h("div", { className: "sh-cfg-b" },
            h("div", { className: "sh-cfg-f" },
              h("label", { htmlFor: "sh-api" }, tr("cfg.api")),
              h("input", {
                id: "sh-api",
                type: "text",
                value: draft.apiBase,
                onChange: (e) => setDraft({ ...draft, apiBase: e.target.value }),
              }),
            ),
            h("div", { className: "sh-cfg-f" },
              h("label", { htmlFor: "sh-dir" }, tr("cfg.dir")),
              h("input", {
                id: "sh-dir",
                type: "text",
                value: draft.skillsDir,
                onChange: (e) => setDraft({ ...draft, skillsDir: e.target.value }),
              }),
            ),
            h("div", { className: "sh-cfg-f" },
              h("label", { htmlFor: "sh-max" }, tr("cfg.max")),
              h("input", {
                id: "sh-max",
                type: "number",
                min: 1,
                max: 80,
                value: draft.maxResults,
                onChange: (e) => setDraft({ ...draft, maxResults: Number(e.target.value) || 12 }),
              }),
            ),
            h("div", { className: "sh-cfg-ft" },
              err ? h("p", { className: "sh-cfg-err" }, err) : null,
              h("button", { type: "button", className: "sh-cfg-disc", disabled: !dirty || saving, onClick: () => setDraft(saved) }, tr("cfg.discard")),
              h("button", { type: "button", className: "sh-cfg-save", disabled: !dirty || saving, onClick: save }, saving ? tr("cfg.saving") : tr("cfg.save")),
            ),
          ) : null,
        ),
      ));
    }

    const MARKET_CAT_EN = {
      "fun-dressup": "Fun dress-up",
      "web-tools": "Web tools",
      memory: "Memory",
      "agent-workflow": "Agent workflow",
      "model-inference": "Model inference",
      client: "Client",
      "admin-security": "Admin & security",
    };
    const MARKET_CAT_FALLBACK = [
      { key: "fun-dressup", displayName: "趣味换装" },
      { key: "web-tools", displayName: "联网工具" },
      { key: "memory", displayName: "记忆" },
      { key: "agent-workflow", displayName: "Agent 工作流" },
      { key: "model-inference", displayName: "模型推理" },
      { key: "client", displayName: "客户端" },
      { key: "admin-security", displayName: "管理安全" },
    ];

    function pluginLetter(plugin) {
      const raw = String((plugin && plugin.name) || (plugin && plugin.owner) || "");
      const ch = raw.match(/[A-Za-z0-9]|[\u4e00-\u9fff]/);
      return (ch ? ch[0] : "?").toUpperCase();
    }

    function MarketAvatar({ plugin }) {
      const [failed, setFailed] = useState(false);
      const src = !failed && plugin.avatarUrl ? iconSrc(plugin.avatarUrl) : "";
      if (src) {
        return h("img", {
          className: "sh-mkt-avatar",
          src,
          alt: "",
          onError: () => setFailed(true),
        });
      }
      return h("div", {
        className: "sh-mkt-avatar sh-mkt-avatar-fallback",
        "aria-hidden": "true",
      }, pluginLetter(plugin));
    }

    function SearchIcon() {
      return h("svg", { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
        h("circle", { cx: "7", cy: "7", r: "5.25", stroke: "currentColor", strokeWidth: "1.5" }),
        h("path", { d: "M11 11.5 14 14.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
      );
    }

    function queueInstallPrompt(sessions, locale) {
      return async (plugin) => {
        const current = sessions && sessions.list && sessions.list.getSnapshot && sessions.list.getSnapshot().current;
        if (!current) throw new Error(locale === "en" ? EN["mkt.noTask"] : ZH["mkt.noTask"]);
        const binding = sessions.binding && sessions.binding(current);
        if (!binding || !binding.session || typeof binding.session.prompt !== "function") {
          throw new Error(locale === "en" ? EN["mkt.unavailableTask"] : ZH["mkt.unavailableTask"]);
        }
        const body = await api("pluginInstallPrompt", {
          owner: plugin.owner,
          name: plugin.name,
          fullName: plugin.fullName,
          locale,
        });
        await binding.session.prompt([{ type: "text", text: body.prompt }], "queue");
      };
    }

    function Marketplace(props) {
      useEffect(() => ensureCss(), []);
      const tr = typeof props.t === "function" ? props.t : lookup;
      const locale = tr("locale") === "en" ? "en" : "zh";
      const [query, setQuery] = useState("");
      const [submitted, setSubmitted] = useState("");
      const [category, setCategory] = useState("");
      const [page, setPage] = useState(1);
      const [items, setItems] = useState([]);
      const [total, setTotal] = useState(0);
      const [status, setStatus] = useState("loading");
      const [err, setErr] = useState("");
      const [sending, setSending] = useState("");
      const [feedback, setFeedback] = useState("");
      const [cats, setCats] = useState(MARKET_CAT_FALLBACK);
      const install = React.useMemo(() => queueInstallPrompt(props.sessions, locale), [props.sessions, locale]);
      useEffect(() => {
        let live = true;
        api("pluginCategories", {})
          .then((d) => {
            if (!live) return;
            const items = Array.isArray(d.items) ? d.items.filter((it) => it && it.key) : [];
            if (items.length) setCats(items);
          })
          .catch(() => {});
        return () => { live = false; };
      }, []);
      useEffect(() => {
        let live = true;
        if (page === 1) setStatus("loading");
        api("plugins", { q: submitted, scope: "verified", category, sort: "stars", page, pageSize: 48 })
          .then((d) => {
            if (!live) return;
            setItems((cur) => page === 1 ? (d.items || []) : cur.concat(d.items || []));
            setTotal(Number(d.total) || 0);
            setStatus("ready");
            setErr("");
          })
          .catch((e) => {
            if (!live) return;
            if (page === 1) {
              setItems([]);
              setTotal(0);
            }
            setStatus("error");
            setErr(e.message || String(e));
          });
        return () => { live = false; };
      }, [submitted, category, page]);
      const catLabelFor = (key) => {
        if (!key) return "";
        if (locale === "en" && MARKET_CAT_EN[key]) return MARKET_CAT_EN[key];
        const hit = cats.find((it) => it.key === key);
        return (hit && hit.displayName) || MARKET_CAT_FALLBACK.find((it) => it.key === key)?.displayName || key;
      };
      const detailHref = (plugin) => {
        const repo = String(plugin.repositoryUrl || "").trim();
        if (/^https:\/\/github\.com\//i.test(repo)) return repo;
        return "https://github.com/" + encodeURIComponent(plugin.owner) + "/" + encodeURIComponent(plugin.name);
      };
      return h(I18nProvider, { t: tr },
        h("div", { className: "sh-mkt" },
          h("form", {
            className: "sh-mkt-search",
            onSubmit: (e) => { e.preventDefault(); setSubmitted(query.trim()); setPage(1); },
          },
            h("div", { className: "sh-mkt-field" },
              h(SearchIcon),
              h("input", {
                type: "search",
                value: query,
                placeholder: tr("mkt.searchPlaceholder"),
                onChange: (e) => setQuery(e.currentTarget.value),
              }),
            ),
            h("button", { type: "submit", className: "sh-mkt-go" }, tr("mkt.search")),
          ),
          h("div", { className: "sh-mkt-filters" },
            h("button", {
              type: "button",
              className: "sh-mkt-filter" + (!category ? " on" : ""),
              onClick: () => { setCategory(""); setPage(1); },
            }, tr("mkt.catAll")),
            cats.map((it) => h("button", {
              key: it.key,
              type: "button",
              className: "sh-mkt-filter" + (category === it.key ? " on" : ""),
              onClick: () => { setCategory(it.key); setPage(1); },
            }, catLabelFor(it.key))),
          ),
          status === "ready" ? h("div", { className: "sh-mkt-results" },
            h("p", { className: "sh-mkt-summary" }, tr("mkt.repos", { n: total })),
          ) : null,
          feedback ? h("p", { className: "sh-mkt-status", style: { padding: "0 2px" } }, feedback) : null,
          status === "loading" && page === 1 ? h("p", { className: "sh-mkt-status" }, tr("mkt.loading")) : null,
          status === "error" ? h("p", { className: "sh-mkt-status" }, tr("mkt.error", { m: err })) : null,
          status === "ready" && !items.length ? h("p", { className: "sh-mkt-status" }, tr("mkt.empty")) : null,
          items.length ? h("div", { className: "sh-mkt-grid" },
            items.map((plugin) => {
              const id = plugin.fullName || (plugin.owner + "/" + plugin.name);
              const verified = plugin.installability === "verified";
              return h("article", { key: id, className: "sh-mkt-card" },
                h("div", { className: "sh-mkt-head" },
                  h(MarketAvatar, { plugin }),
                  h("div", { className: "sh-mkt-head-main" },
                    h("div", { className: "sh-mkt-top" },
                      h("p", { className: "sh-mkt-owner" }, plugin.owner),
                      h("span", { className: "sh-mkt-badge" + (verified ? " ok" : "") }, verified ? tr("mkt.verified") : tr("mkt.unsupported")),
                    ),
                    h("div", { className: "sh-mkt-name" }, plugin.name),
                  ),
                ),
                h("p", { className: "sh-mkt-desc" }, plugin.description || tr("mkt.noDesc")),
                h("div", { className: "sh-mkt-meta" },
                  h("span", null, catLabelFor(plugin.categoryKey) || plugin.categoryKey),
                  h("span", null, "★ " + (Number(plugin.stars) || 0)),
                ),
                h("div", { className: "sh-mkt-actions" },
                  h("a", { className: "sh-mkt-details", href: detailHref(plugin), target: "_blank", rel: "noreferrer" }, tr("mkt.details")),
                  h("button", {
                    type: "button",
                    className: "sh-mkt-install",
                    disabled: !verified || sending === id,
                    onClick: () => {
                      setSending(id);
                      setFeedback("");
                      install(plugin).then(
                        () => {
                          setFeedback(tr("mkt.sent", { name: plugin.fullName || id }));
                          if (typeof props.onSent === "function") props.onSent();
                        },
                        (e) => setFeedback(e.message || String(e)),
                      ).finally(() => setSending(""));
                    },
                  }, !verified ? tr("mkt.unsupported") : (sending === id ? tr("mkt.sending") : tr("mkt.install"))),
                ),
              );
            }),
          ) : null,
          status === "ready" && items.length < total ? h("button", {
            type: "button",
            className: "sh-mkt-more",
            onClick: () => setPage((n) => n + 1),
          },
            h("span", null, tr("mkt.more")),
            h("span", { className: "sh-mkt-more-left" }, tr("mkt.moreLeft", { n: Math.max(0, total - items.length) })),
            h(ChevronDown),
          ) : null,
        ),
      );
    }

    const SKILL_CAT_KEYS = [
      "office-efficiency", "content-creation", "dev-programming", "data-analysis",
      "design-media", "ai-agent", "knowledge-management", "business-ops",
      "education", "professional", "it-ops-security", "life-service",
    ];

    function PlazaIcon() {
      return h("svg", { viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
        h("rect", { x: "1.75", y: "1.75", width: "5.5", height: "5.5", rx: "1.2", stroke: "currentColor", strokeWidth: "1.4" }),
        h("rect", { x: "8.75", y: "1.75", width: "5.5", height: "5.5", rx: "1.2", stroke: "currentColor", strokeWidth: "1.4" }),
        h("rect", { x: "1.75", y: "8.75", width: "5.5", height: "5.5", rx: "1.2", stroke: "currentColor", strokeWidth: "1.4" }),
        h("rect", { x: "8.75", y: "8.75", width: "5.5", height: "5.5", rx: "1.2", stroke: "currentColor", strokeWidth: "1.4" }),
      );
    }

    function SkillPlaza() {
      const tr = useTr();
      const pageSize = 48;
      const [query, setQuery] = useState("");
      const [submitted, setSubmitted] = useState("");
      const [category, setCategory] = useState("");
      const [page, setPage] = useState(1);
      const [items, setItems] = useState([]);
      const [total, setTotal] = useState(0);
      const [hasMore, setHasMore] = useState(false);
      const [status, setStatus] = useState("loading");
      const [err, setErr] = useState("");
      const [open, setOpen] = useState(null);
      useEffect(() => {
        let live = true;
        if (page === 1) setStatus("loading");
        api("search", { query: submitted, category, limit: pageSize, offset: (page - 1) * pageSize })
          .then((d) => {
            if (!live) return;
            const next = d.items || [];
            setItems((cur) => page === 1 ? next : cur.concat(next));
            setTotal(Number(d.total) || 0);
            setHasMore(!!d.hasMore);
            setStatus("ready");
            setErr("");
          })
          .catch((e) => {
            if (!live) return;
            if (page === 1) {
              setItems([]);
              setTotal(0);
              setHasMore(false);
            }
            setStatus("error");
            setErr(e.message || String(e));
          });
        return () => { live = false; };
      }, [submitted, category, page]);
      const mark = (item, installed) => {
        setItems((cur) => cur.map((it) => it.slug === item.slug ? { ...it, installed } : it));
        setOpen((cur) => cur && cur.slug === item.slug ? { ...cur, installed } : cur);
      };
      const remaining = Math.max(0, total - items.length);
      return h("div", { className: "sh-mkt" },
        h("form", {
          className: "sh-mkt-search",
          onSubmit: (e) => { e.preventDefault(); setPage(1); setSubmitted(query.trim()); },
        },
          h("div", { className: "sh-mkt-field" },
            h(SearchIcon),
            h("input", {
              type: "search",
              value: query,
              placeholder: tr("mkt.searchPlaceholder"),
              onChange: (e) => setQuery(e.currentTarget.value),
            }),
          ),
          h("button", { type: "submit", className: "sh-mkt-go" }, tr("mkt.search")),
        ),
        h("div", { className: "sh-mkt-filters" },
          h("button", {
            type: "button",
            className: "sh-mkt-filter" + (!category ? " on" : ""),
            onClick: () => { setCategory(""); setPage(1); },
          }, tr("mkt.catAll")),
          SKILL_CAT_KEYS.map((key) => h("button", {
            key,
            type: "button",
            className: "sh-mkt-filter" + (category === key ? " on" : ""),
            onClick: () => { setCategory(key); setPage(1); },
          }, tr("cat." + key))),
        ),
        status === "ready" ? h("div", { className: "sh-mkt-results" },
          h("p", { className: "sh-mkt-summary" }, tr("search.hint", { n: total || items.length })),
        ) : null,
        status === "loading" && page === 1 ? h("p", { className: "sh-mkt-status" }, tr("mkt.loading")) : null,
        status === "error" ? h("p", { className: "sh-mkt-status" }, tr("mkt.error", { m: err })) : null,
        status === "ready" && !items.length ? h("p", { className: "sh-mkt-status" }, tr("search.empty")) : null,
        items.length ? h(Cards, { items, onOpen: setOpen }) : null,
        status === "ready" && (hasMore || remaining > 0) ? h("button", {
          type: "button",
          className: "sh-mkt-more",
          onClick: () => setPage((n) => n + 1),
        },
          h("span", null, tr("mkt.more")),
          remaining ? h("span", { className: "sh-mkt-more-left" }, tr("mkt.moreLeft", { n: remaining })) : null,
          h(ChevronDown),
        ) : null,
        open ? h(Drawer, {
          item: open,
          onClose: () => setOpen(null),
          onInstalled: (it) => mark(it, true),
          onUninstalled: (it) => mark(it, false),
        }) : null,
      );
    }

    function conversationRoot() {
      return typeof document === "undefined" ? null : document.querySelector("[data-phase]");
    }

    function conversationBox() {
      const el = conversationRoot();
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, width: r.width, height: r.height };
    }

    function useConversationBox(active) {
      const [box, setBox] = useState(null);
      const layout = React.useLayoutEffect || useEffect;
      layout(() => {
        if (!active) {
          setBox(null);
          return;
        }
        const update = () => setBox(conversationBox());
        update();
        const root = conversationRoot();
        const ro = root && typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
        if (root && ro) ro.observe(root);
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
          if (ro) ro.disconnect();
          window.removeEventListener("resize", update);
          window.removeEventListener("scroll", update, true);
        };
      }, [active]);
      return box;
    }

    function PlazaView({ sessions, t, onClose, box }) {
      useEffect(() => {
        ensureCss();
        const onKey = (e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
      }, [onClose]);
      const tr = typeof t === "function" ? t : lookup;
      const [tab, setTab] = useState("plugins");
      return h(I18nProvider, { t: tr },
        h("div", {
          className: "sh-plaza-page",
          role: "dialog",
          "aria-modal": "false",
          "aria-label": tr("plaza.title"),
          style: {
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          },
        },
          h("div", { className: "sh-plaza-top" },
            h("div", { className: "sh-plaza-tabs", role: "tablist" },
              h("button", {
                type: "button",
                role: "tab",
                className: "sh-plaza-tab" + (tab === "plugins" ? " on" : ""),
                "aria-selected": tab === "plugins",
                onClick: () => setTab("plugins"),
              }, tr("plaza.plugins")),
              h("button", {
                type: "button",
                role: "tab",
                className: "sh-plaza-tab" + (tab === "skills" ? " on" : ""),
                "aria-selected": tab === "skills",
                onClick: () => setTab("skills"),
              }, tr("plaza.skills")),
            ),
            h("button", {
              type: "button",
              className: "sh-plaza-close",
              onClick: onClose,
              "aria-label": tr("plaza.back"),
              title: tr("plaza.back"),
            }, "×"),
          ),
          h("div", { className: "sh-plaza-body" },
            tab === "skills" ? h(SkillPlaza) : h(Marketplace, { sessions, t: tr, onSent: onClose }),
          ),
        ),
      );
    }

    function sessionListCurrent(sessions) {
      try {
        return sessions && sessions.list && typeof sessions.list.getSnapshot === "function"
          ? sessions.list.getSnapshot().current
          : undefined;
      } catch {
        return undefined;
      }
    }

    function PlazaAction({ wide, sessions, t }) {
      useEffect(() => ensureCss(), []);
      const tr = typeof t === "function" ? t : lookup;
      const [open, setOpen] = useState(false);
      const [hint, setHint] = useState("");
      const close = React.useCallback(() => setOpen(false), []);
      const box = useConversationBox(open);
      useEffect(() => {
        if (!open) return;
        if (conversationRoot()) return;
        setOpen(false);
        setHint(tr("plaza.noSession"));
      }, [open, box, tr]);
      useEffect(() => {
        if (!open) return;
        const list = sessions && sessions.list;
        if (!list || typeof list.subscribe !== "function") return;
        let last = sessionListCurrent(sessions);
        return list.subscribe(() => {
          const now = sessionListCurrent(sessions);
          if (now === last) return;
          last = now;
          close();
        });
      }, [open, sessions, close]);
      useEffect(() => {
        if (!open) return;
        const onPointer = (e) => {
          const node = e.target;
          if (!node || typeof node.closest !== "function") return;
          if (node.closest(".sh-plaza-page, .sh-plaza-wrap, .sh-overlay")) return;
          close();
        };
        document.addEventListener("pointerdown", onPointer, true);
        return () => document.removeEventListener("pointerdown", onPointer, true);
      }, [open, close]);
      const panel = open && box && typeof document !== "undefined"
        ? createPortal(h(PlazaView, { sessions, t: tr, onClose: close, box }), document.body)
        : null;
      return h(I18nProvider, { t: tr },
        h("div", { className: "sh-plaza-wrap" + (wide ? "" : " rail") },
          h("button", {
            type: "button",
            className: "sh-plaza-trigger" + (open ? " on" : ""),
            "aria-label": tr("plaza.title"),
            "aria-expanded": open,
            onClick: () => {
              if (open) {
                close();
                setHint("");
                return;
              }
              if (!conversationBox()) {
                setHint(tr("plaza.noSession"));
                return;
              }
              setOpen(true);
              setHint("");
            },
          },
            h(PlazaIcon),
            wide ? h("span", null, tr("plaza.title")) : null,
          ),
          hint ? h(Toast, { text: hint, onDone: () => setHint("") }) : null,
          panel,
        ),
      );
    }

    const inject = ["slots", "sessions"];
    // rc.6 list slots require `id`; rc.7+ keyed slots require `key`. Pass both.
    function registerSlot(slots, options, component) {
      const next = { ...options };
      if (next.id == null && next.key != null) next.id = String(next.key);
      if (next.key == null && next.id != null) next.key = next.id;
      return slots.register(next, component);
    }
    function apply(ctx) {
      const slots = ctx.slots;
      const sessions = ctx.sessions;
      if (!slots) return;
      ctx.inject(["locale"], (c) => {
        if (!c.locale || typeof c.locale.register !== "function") return;
        c.effect(() => {
          try {
            return c.locale.register("skillhub", { zh: ZH, en: EN });
          } catch {
            return () => {};
          }
        }, "skillhub-locale");
      });
      ctx.effect(() => ensureCss(), "skillhub-style");
      slots.inject("tool.call.toolview", () => registerSlot(
        slots,
        { name: "tool.call.toolview", key: "skillhub_search", locale: "skillhub" },
        SearchToolView,
      ));
      slots.inject("tool.call.toolview", () => registerSlot(
        slots,
        { name: "tool.call.toolview", key: "skillhub_list", locale: "skillhub" },
        ListToolView,
      ));
      slots.inject("settings.plugin.item", () => registerSlot(
        slots,
        { name: "settings.plugin.item", key: "skillhub", locale: "skillhub" },
        ConfigCard,
      ));
      slots.inject("sidebar.footer.action", () => registerSlot(
        slots,
        { name: "sidebar.footer.action", id: "skillhub-plaza", order: 8, label: () => lookup("plaza.title"), locale: "skillhub" },
        function PlazaEntry(actionProps) {
          return h(PlazaAction, { ...actionProps, sessions });
        },
      ));
    }

    return { inject, apply };
  },
});
