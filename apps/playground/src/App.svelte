<script lang="ts">
  import {
    applyTheme,
    configure,
    downloadPng,
    downloadSvg,
    getTheme,
    LIGHT_THEME,
    registerTheme,
    type LocaleName,
  } from '@d3scope/core';
  import {
    buildSnippet,
    CHART_KINDS,
    drawChart,
    parseChartData,
    SAMPLES,
    type ChartKind,
  } from './lib/playground';

  // A second theme to show that switching tokens restyles the chrome.
  registerTheme('warm', {
    ...LIGHT_THEME,
    surface: '#fff7ed',
    text: '#431407',
    textMuted: '#9a3412',
    border: '#fdba74',
    grid: '#ffedd5',
    accent: '#c2410c',
  });
  const THEMES = ['default', 'warm'] as const;

  const WIDTH = 560;
  const HEIGHT = 320;

  let kind = $state<ChartKind>('bar');
  let text = $state(SAMPLES.bar);
  let tooltip = $state(true);
  let locale = $state<LocaleName>('fr-FR');
  let themeName = $state<(typeof THEMES)[number]>('default');
  let copied = $state(false);

  let svgEl = $state<SVGSVGElement | undefined>();
  let frame = $state<HTMLDivElement | undefined>();

  const parsed = $derived(parseChartData(kind, text));
  const options = $derived({ width: WIDTH, height: HEIGHT, tooltip, locale });
  const snippet = $derived(parsed.ok ? buildSnippet(kind, parsed.value, options) : '');

  // Switching the chart type recreates the svg (see {#key}), so tooltips
  // from the previous chart are dropped with it.
  $effect(() => {
    configure({ locale });
  });

  $effect(() => {
    if (frame) applyTheme(frame, getTheme(themeName));
  });

  $effect(() => {
    if (!svgEl || !parsed.ok) return;
    drawChart(svgEl, kind, parsed.value, options);
  });

  function selectKind(next: ChartKind): void {
    kind = next;
    text = SAMPLES[next];
  }

  async function copySnippet(): Promise<void> {
    await navigator.clipboard.writeText(snippet);
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1500);
  }
</script>

<main>
  <header>
    <h1>D3SCOPE — playground</h1>
    <p class="hint">Éditez les données, changez le type ou le thème ; le graphe se met à jour.</p>
  </header>

  <section class="controls" aria-label="Options">
    <label>
      Type
      <select
        value={kind}
        onchange={(e) => {
          selectKind(e.currentTarget.value as ChartKind);
        }}
      >
        {#each CHART_KINDS as k (k.id)}
          <option value={k.id}>{k.label}</option>
        {/each}
      </select>
    </label>
    <label>
      Thème
      <select bind:value={themeName}>
        {#each THEMES as t (t)}
          <option value={t}>{t}</option>
        {/each}
      </select>
    </label>
    <label>
      Locale
      <select bind:value={locale}>
        <option value="fr-FR">fr-FR</option>
        <option value="en-US">en-US</option>
      </select>
    </label>
    <label class="check">
      <input type="checkbox" bind:checked={tooltip} />
      Tooltip
    </label>
  </section>

  <div class="grid">
    <section class="editor" aria-label="Données">
      <label for="data">Données (JSON)</label>
      <textarea id="data" spellcheck="false" bind:value={text}></textarea>
      {#if !parsed.ok}
        <p class="error" role="alert">{parsed.error}</p>
      {/if}
    </section>

    <section class="preview" aria-label="Aperçu">
      <div class="frame" bind:this={frame}>
        {#key kind}
          <svg bind:this={svgEl} class="chart" role="img" aria-label="Aperçu du graphe"></svg>
        {/key}
      </div>
      <div class="actions">
        <button
          type="button"
          disabled={!svgEl}
          onclick={() => {
            if (svgEl) void downloadPng(svgEl, `${kind}.png`);
          }}>Exporter PNG</button
        >
        <button
          type="button"
          disabled={!svgEl}
          onclick={() => {
            if (svgEl) downloadSvg(svgEl, `${kind}.svg`);
          }}>Exporter SVG</button
        >
      </div>
    </section>
  </div>

  <section class="snippet" aria-label="Code">
    <div class="snippet-head">
      <span>Code</span>
      <button type="button" disabled={!parsed.ok} onclick={copySnippet}>
        {copied ? 'Copié' : 'Copier'}
      </button>
    </div>
    <pre><code>{snippet}</code></pre>
  </section>
</main>
