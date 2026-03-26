import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import * as d3 from 'd3';
import { Button } from '../primitives/Button';
import { cn } from '../lib/cn';

const parseDate = d3.utcParse('%Y-%m-%d');
const formatDate = d3.utcFormat('%b %d');

interface ChartTheme {
  bg: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

interface ChartDimensions {
  width: number;
  height: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
}

function readChartTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement);
  return {
    bg: styles.getPropertyValue('--color-bg-elevated').trim(),
    text: styles.getPropertyValue('--color-text').trim(),
    textMuted: styles.getPropertyValue('--color-text-muted').trim(),
    border: styles.getPropertyValue('--color-border').trim(),
    accent: styles.getPropertyValue('--color-accent').trim(),
    success: styles.getPropertyValue('--color-success').trim(),
    warning: styles.getPropertyValue('--color-warning').trim(),
    danger: styles.getPropertyValue('--color-danger').trim(),
  };
}

function createChartEnvironment() {
  const [width, setWidth] = createSignal(0);
  const [themeVersion, setThemeVersion] = createSignal(0);
  let rootRef: HTMLDivElement | undefined;

  onMount(() => {
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect.width ?? 0;
      setWidth(nextWidth);
    });

    const mutationObserver = new MutationObserver(() => {
      setThemeVersion((current) => current + 1);
    });

    if (rootRef) {
      observer.observe(rootRef);
    }

    mutationObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    onCleanup(() => {
      observer.disconnect();
      mutationObserver.disconnect();
    });
  });

  return {
    rootRef: (element: HTMLDivElement) => {
      rootRef = element;
    },
    width,
    themeVersion,
  };
}

function buildChartDimensions(width: number, height: number, marginRight: number = 56): ChartDimensions {
  return {
    width,
    height,
    marginTop: 20,
    marginRight,
    marginBottom: 30,
    marginLeft: 48,
  };
}

function getInnerWidth(dimensions: ChartDimensions): number {
  return Math.max(0, dimensions.width - dimensions.marginLeft - dimensions.marginRight);
}

function getInnerHeight(dimensions: ChartDimensions): number {
  return Math.max(0, dimensions.height - dimensions.marginTop - dimensions.marginBottom);
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getDateTicks(values: Date[], width: number): Date[] {
  if (values.length <= 7) {
    return values;
  }

  const scale = d3.scaleUtc()
    .domain(d3.extent(values) as [Date, Date])
    .range([0, width]);

  return scale.ticks(Math.max(2, Math.floor(width / 120)));
}

interface TimeSeriesChartSeries {
  key: string;
  label: string;
  color: string;
  axis?: 'left' | 'right';
}

interface ChartLegendItem {
  key: string;
  label: string;
  color: string;
}

interface TimeSeriesDatum {
  date: string;
  [key: string]: string | number | null;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDatum[];
  series: TimeSeriesChartSeries[];
  height?: number;
  class?: string;
  showLegend?: boolean;
  hiddenKeys?: Set<string>;
  onToggleLegend?: (key: string) => void;
  yLeftLabel?: string;
  yRightLabel?: string;
  formatLeftValue?: (value: number) => string;
  formatRightValue?: (value: number) => string;
  tooltipTitle?: string;
}

interface ChartLegendProps {
  items: ChartLegendItem[];
  mutedKeys?: Set<string>;
  onToggle?: (key: string) => void;
}

export function ChartLegend(props: ChartLegendProps) {
  return (
    <div class="ui-chart__legend">
      <For each={props.items}>
        {(item) => (
          props.onToggle ? (
            <button
              type="button"
              class={cn('ui-chart__legend-button', props.mutedKeys?.has(item.key) && 'ui-chart__legend-button--muted')}
              onClick={() => props.onToggle?.(item.key)}
            >
              <span class="ui-chart__legend-swatch" style={{ background: item.color }} />
              <span>{item.label}</span>
            </button>
          ) : (
            <div class="ui-chart__legend-static">
              <span class="ui-chart__legend-swatch" style={{ background: item.color }} />
              <span>{item.label}</span>
            </div>
          )
        )}
      </For>
    </div>
  );
}

type ParsedTimeSeriesDatum = TimeSeriesDatum & { parsedDate: Date };
type ParsedComboDatum = { date: string; lineValue: number; barValue: number; parsedDate: Date };
type ParsedBoxPlotDatum = { date: string; min: number; q1: number; median: number; q3: number; max: number; parsedDate: Date };

export function TimeSeriesChart(props: TimeSeriesChartProps) {
  const env = createChartEnvironment();
  const [internalHiddenSeries, setInternalHiddenSeries] = createSignal<Set<string>>(new Set());
  const [hoverIndex, setHoverIndex] = createSignal<number | null>(null);

  const theme = createMemo(() => {
    env.themeVersion();
    return readChartTheme();
  });

  const hiddenSeries = createMemo(() => props.hiddenKeys ?? internalHiddenSeries());
  const visibleSeries = createMemo(() => props.series.filter((series) => !hiddenSeries().has(series.key)));
  const chartHeight = () => props.height ?? 240;
  const dimensions = createMemo(() => buildChartDimensions(env.width(), chartHeight(), props.series.some((series) => series.axis === 'right') ? 56 : 20));

  const points = createMemo(() =>
    props.data
      .map((row) => ({
        ...row,
        parsedDate: parseDate(row.date),
      }))
      .filter((row): row is ParsedTimeSeriesDatum => row.parsedDate instanceof Date)
      .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime())
  );

  const xScale = createMemo(() => {
    const values = points().map((point) => point.parsedDate);
    const domain = d3.extent(values) as [Date, Date];
    return d3.scaleUtc().domain(domain).range([dimensions().marginLeft, dimensions().marginLeft + getInnerWidth(dimensions())]);
  });

  const leftSeries = createMemo(() => visibleSeries().filter((series) => series.axis !== 'right'));
  const rightSeries = createMemo(() => visibleSeries().filter((series) => series.axis === 'right'));

  const leftScale = createMemo(() => {
    const maxValue =
      d3.max(points(), (point: ParsedTimeSeriesDatum) =>
        d3.max(leftSeries(), (series: TimeSeriesChartSeries) => Number(point[series.key] ?? 0))
      ) ?? 0;
    return d3.scaleLinear().domain([0, maxValue === 0 ? 1 : maxValue * 1.1]).nice().range([dimensions().marginTop + getInnerHeight(dimensions()), dimensions().marginTop]);
  });

  const rightScale = createMemo(() => {
    const maxValue =
      d3.max(points(), (point: ParsedTimeSeriesDatum) =>
        d3.max(rightSeries(), (series: TimeSeriesChartSeries) => Number(point[series.key] ?? 0))
      ) ?? 0;
    return d3.scaleLinear().domain([0, maxValue === 0 ? 1 : maxValue * 1.1]).nice().range([dimensions().marginTop + getInnerHeight(dimensions()), dimensions().marginTop]);
  });

  const leftTicks = createMemo(() => leftScale().ticks(4));
  const rightTicks = createMemo(() => rightSeries().length > 0 ? rightScale().ticks(4) : []);
  const xTicks = createMemo(() => xScale().ticks(Math.max(2, Math.floor(getInnerWidth(dimensions()) / 120))));
  const dateTicks = createMemo(() => getDateTicks(points().map((point) => point.parsedDate), getInnerWidth(dimensions())));

  const linePath = (series: TimeSeriesChartSeries) =>
    d3.line()
      .defined((point: ParsedTimeSeriesDatum) => typeof point[series.key] === 'number')
      .x((point: ParsedTimeSeriesDatum) => xScale()(point.parsedDate))
      .y((point: ParsedTimeSeriesDatum) => (series.axis === 'right' ? rightScale() : leftScale())(Number(point[series.key] ?? 0)))(points()) ?? '';

  const hoveredPoint = createMemo(() => {
    const index = hoverIndex();
    return index === null ? null : points()[index] ?? null;
  });

  const tooltipRows = createMemo(() =>
    hoveredPoint()
      ? visibleSeries()
          .map((series) => ({
            ...series,
            value: Number(hoveredPoint()?.[series.key] ?? 0),
          }))
          .filter((series) => Number.isFinite(series.value))
      : []
  );

  const toggleSeries = (key: string) => {
    if (props.onToggleLegend) {
      props.onToggleLegend(key);
      return;
    }

    setInternalHiddenSeries((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handlePointerMove = (event: PointerEvent) => {
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const hoveredDate = xScale().invert(offsetX);
    const nearestIndex = d3.leastIndex(points(), (point: ParsedTimeSeriesDatum) => Math.abs(point.parsedDate.getTime() - hoveredDate.getTime()));
    setHoverIndex(nearestIndex ?? null);
  };

  return (
    <div class={cn('ui-chart', props.class)}>
      <Show when={props.showLegend !== false && props.series.length > 1}>
        <ChartLegend items={props.series} mutedKeys={hiddenSeries()} onToggle={toggleSeries} />
      </Show>

      <div class="ui-chart__frame" ref={env.rootRef}>
        <Show when={env.width() > 0 && points().length > 0} fallback={<div class="ui-chart__empty">No chart data available.</div>}>
          <svg viewBox={`0 0 ${dimensions().width} ${dimensions().height}`} class="ui-chart__svg" role="img" aria-label={props.tooltipTitle ?? 'Time series chart'}>
            <g>
              <For each={leftTicks()}>
                {(tick) => (
                  <g>
                    <line
                      x1={dimensions().marginLeft}
                      x2={dimensions().marginLeft + getInnerWidth(dimensions())}
                      y1={leftScale()(tick)}
                      y2={leftScale()(tick)}
                      stroke={theme().border}
                      stroke-dasharray="3 4"
                    />
                    <text x={dimensions().marginLeft - 8} y={leftScale()(tick)} fill={theme().textMuted} text-anchor="end" dominant-baseline="middle" class="ui-chart__tick">
                      {(props.formatLeftValue ?? formatCompactNumber)(tick)}
                    </text>
                  </g>
                )}
              </For>

              <For each={dateTicks()}>
                {(tick) => (
                  <text
                    x={xScale()(tick)}
                    y={dimensions().marginTop + getInnerHeight(dimensions()) + 20}
                    fill={theme().textMuted}
                    text-anchor="middle"
                    class="ui-chart__tick"
                  >
                    {formatDate(tick)}
                  </text>
                )}
              </For>

              <For each={visibleSeries()}>
                {(series) => (
                  <path
                    d={linePath(series)}
                    fill="none"
                    stroke={series.color}
                    stroke-width="2.25"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                )}
              </For>

              <Show when={rightSeries().length > 0}>
                <For each={rightTicks()}>
                  {(tick) => (
                    <text
                      x={dimensions().width - dimensions().marginRight + 8}
                      y={rightScale()(tick)}
                      fill={theme().textMuted}
                      text-anchor="start"
                      dominant-baseline="middle"
                      class="ui-chart__tick"
                    >
                      {(props.formatRightValue ?? formatCompactNumber)(tick)}
                    </text>
                  )}
                </For>
              </Show>

              <Show when={hoveredPoint()}>
                {(point) => (
                  <>
                    <line
                      x1={xScale()(point().parsedDate)}
                      x2={xScale()(point().parsedDate)}
                      y1={dimensions().marginTop}
                      y2={dimensions().marginTop + getInnerHeight(dimensions())}
                      stroke={theme().textMuted}
                      stroke-dasharray="4 4"
                    />
                    <For each={tooltipRows()}>
                      {(series) => (
                        <circle
                          cx={xScale()(point().parsedDate)}
                          cy={(series.axis === 'right' ? rightScale() : leftScale())(series.value)}
                          r="4"
                          fill={series.color}
                          stroke={theme().bg}
                          stroke-width="2"
                        />
                      )}
                    </For>
                  </>
                )}
              </Show>

              <rect
                x={dimensions().marginLeft}
                y={dimensions().marginTop}
                width={getInnerWidth(dimensions())}
                height={getInnerHeight(dimensions())}
                fill="transparent"
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setHoverIndex(null)}
              />
            </g>
          </svg>

          <Show when={hoveredPoint()}>
            {(point) => (
              <div class="ui-chart__tooltip">
                <div class="ui-chart__tooltip-title">{formatDate(point().parsedDate)}</div>
                <For each={tooltipRows()}>
                  {(series) => (
                    <div class="ui-chart__tooltip-row">
                      <span class="ui-chart__legend-swatch" style={{ background: series.color }} />
                      <span>{series.label}</span>
                      <strong>
                        {(series.axis === 'right'
                          ? props.formatRightValue ?? formatCompactNumber
                          : props.formatLeftValue ?? formatCompactNumber)(series.value)}
                      </strong>
                    </div>
                  )}
                </For>
              </div>
            )}
          </Show>
        </Show>
      </div>

      <Show when={props.yLeftLabel || props.yRightLabel}>
        <div class="ui-chart__axis-labels">
          <Show when={props.yLeftLabel}>
            <span>{props.yLeftLabel}</span>
          </Show>
          <Show when={props.yRightLabel}>
            <span>{props.yRightLabel}</span>
          </Show>
        </div>
      </Show>
    </div>
  );
}

interface ComboChartProps {
  data: Array<{ date: string; lineValue: number; barValue: number }>;
  lineLabel: string;
  barLabel: string;
  lineColor?: string;
  barColor?: string;
  height?: number;
  showLegend?: boolean;
}

export function ComboChart(props: ComboChartProps) {
  const env = createChartEnvironment();
  const [hoverIndex, setHoverIndex] = createSignal<number | null>(null);
  const theme = createMemo(() => {
    env.themeVersion();
    return readChartTheme();
  });
  const dimensions = createMemo(() => buildChartDimensions(env.width(), props.height ?? 240, 60));
  const points = createMemo(() =>
    props.data
      .map((row) => ({ ...row, parsedDate: parseDate(row.date) }))
      .filter((row): row is ParsedComboDatum => row.parsedDate instanceof Date)
      .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime())
  );
  const xScale = createMemo(() => {
    const values = points().map((point) => point.parsedDate);
    const domain = d3.extent(values) as [Date, Date];
    return d3.scaleUtc().domain(domain).range([dimensions().marginLeft, dimensions().marginLeft + getInnerWidth(dimensions())]);
  });
  const barScale = createMemo(() => {
    const maxValue = d3.max(points(), (point: ParsedComboDatum) => point.barValue) ?? 0;
    return d3.scaleLinear().domain([0, maxValue === 0 ? 1 : maxValue * 1.1]).nice().range([dimensions().marginTop + getInnerHeight(dimensions()), dimensions().marginTop]);
  });
  const lineScale = createMemo(() => d3.scaleLinear().domain([0, 100]).range([dimensions().marginTop + getInnerHeight(dimensions()), dimensions().marginTop]));
  const dateTicks = createMemo(() => getDateTicks(points().map((point) => point.parsedDate), getInnerWidth(dimensions())));
  const barTicks = createMemo(() => barScale().ticks(4));
  const linePath = createMemo(
    () =>
      d3.line()
        .x((point: ParsedComboDatum) => xScale()(point.parsedDate))
        .y((point: ParsedComboDatum) => lineScale()(point.lineValue))(points()) ?? ''
  );
  const barWidth = createMemo(() => {
    const maxSlotWidth = getInnerWidth(dimensions()) / Math.max(1, points().length);
    return Math.max(8, Math.min(48, maxSlotWidth * 0.6));
  });
  const hoveredPoint = createMemo(() => {
    const index = hoverIndex();
    return index === null ? null : points()[index] ?? null;
  });

  const handlePointerMove = (event: PointerEvent) => {
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const hoveredDate = xScale().invert(offsetX);
    const nearestIndex = d3.leastIndex(points(), (point: ParsedComboDatum) => Math.abs(point.parsedDate.getTime() - hoveredDate.getTime()));
    setHoverIndex(nearestIndex ?? null);
  };

  return (
    <div class="ui-chart">
      <Show when={props.showLegend !== false}>
        <ChartLegend
          items={[
            { key: 'line', label: props.lineLabel, color: props.lineColor ?? theme().accent },
            { key: 'bar', label: props.barLabel, color: props.barColor ?? theme().danger },
          ]}
        />
      </Show>

      <div class="ui-chart__frame" ref={env.rootRef}>
        <Show when={env.width() > 0 && points().length > 0} fallback={<div class="ui-chart__empty">No chart data available.</div>}>
          <svg viewBox={`0 0 ${dimensions().width} ${dimensions().height}`} class="ui-chart__svg" role="img" aria-label="Combo chart">
            <For each={barTicks()}>
              {(tick) => (
                <>
                  <line
                    x1={dimensions().marginLeft}
                    x2={dimensions().marginLeft + getInnerWidth(dimensions())}
                    y1={barScale()(tick)}
                    y2={barScale()(tick)}
                    stroke={theme().border}
                    stroke-dasharray="3 4"
                  />
                  <text x={dimensions().marginLeft - 8} y={barScale()(tick)} fill={theme().textMuted} text-anchor="end" dominant-baseline="middle" class="ui-chart__tick">
                    {formatCompactNumber(tick)}
                  </text>
                </>
              )}
            </For>

            <For each={points()}>
              {(point) => (
                <rect
                  x={Math.max(dimensions().marginLeft, Math.min(xScale()(point.parsedDate) - barWidth() / 2, dimensions().marginLeft + getInnerWidth(dimensions()) - barWidth()))}
                  y={barScale()(point.barValue)}
                  width={barWidth()}
                  height={dimensions().marginTop + getInnerHeight(dimensions()) - barScale()(point.barValue)}
                  fill={props.barColor ?? theme().danger}
                  opacity="0.7"
                  rx="2"
                />
              )}
            </For>

            <path d={linePath()} fill="none" stroke={props.lineColor ?? theme().accent} stroke-width="2.25" />

            <For each={dateTicks()}>
              {(tick) => (
                <text
                  x={xScale()(tick)}
                  y={dimensions().marginTop + getInnerHeight(dimensions()) + 20}
                  fill={theme().textMuted}
                  text-anchor="middle"
                  class="ui-chart__tick"
                >
                  {formatDate(tick)}
                </text>
              )}
            </For>

            <For each={[0, 25, 50, 75, 100]}>
              {(tick) => (
                <text
                  x={dimensions().width - dimensions().marginRight + 8}
                  y={lineScale()(tick)}
                  fill={theme().textMuted}
                  text-anchor="start"
                  dominant-baseline="middle"
                  class="ui-chart__tick"
                >
                  {formatPercent(tick)}
                </text>
              )}
            </For>

            <Show when={hoveredPoint()}>
              {(point) => (
                <>
                  <line
                    x1={xScale()(point().parsedDate)}
                    x2={xScale()(point().parsedDate)}
                    y1={dimensions().marginTop}
                    y2={dimensions().marginTop + getInnerHeight(dimensions())}
                    stroke={theme().textMuted}
                    stroke-dasharray="4 4"
                  />
                  <circle
                    cx={xScale()(point().parsedDate)}
                    cy={lineScale()(point().lineValue)}
                    r="4"
                    fill={props.lineColor ?? theme().accent}
                    stroke={theme().bg}
                    stroke-width="2"
                  />
                </>
              )}
            </Show>

            <rect
              x={dimensions().marginLeft}
              y={dimensions().marginTop}
              width={getInnerWidth(dimensions())}
              height={getInnerHeight(dimensions())}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverIndex(null)}
            />
          </svg>

          <Show when={hoveredPoint()}>
            {(point) => (
              <div class="ui-chart__tooltip">
                <div class="ui-chart__tooltip-title">{formatDate(point().parsedDate)}</div>
                <div class="ui-chart__tooltip-row">
                  <span class="ui-chart__legend-swatch" style={{ background: props.lineColor ?? theme().accent }} />
                  <span>{props.lineLabel}</span>
                  <strong>{formatPercent(point().lineValue)}</strong>
                </div>
                <div class="ui-chart__tooltip-row">
                  <span class="ui-chart__legend-swatch" style={{ background: props.barColor ?? theme().danger }} />
                  <span>{props.barLabel}</span>
                  <strong>{formatCompactNumber(point().barValue)}</strong>
                </div>
              </div>
            )}
          </Show>
        </Show>
      </div>
    </div>
  );
}

interface HistogramChartProps {
  data: Array<{ bin_start: number; bin_end: number; count: number }>;
  height?: number;
}

export function HistogramChart(props: HistogramChartProps) {
  const env = createChartEnvironment();
  const theme = createMemo(() => {
    env.themeVersion();
    return readChartTheme();
  });
  const dimensions = createMemo(() => buildChartDimensions(env.width(), props.height ?? 200, 20));
  const xScale = createMemo(() => {
    const min = d3.min(props.data, (bin: { bin_start: number; bin_end: number; count: number }) => bin.bin_start) ?? 0;
    const max = d3.max(props.data, (bin: { bin_start: number; bin_end: number; count: number }) => bin.bin_end) ?? 1;
    return d3.scaleLinear().domain([min, max]).range([dimensions().marginLeft, dimensions().marginLeft + getInnerWidth(dimensions())]);
  });
  const yScale = createMemo(() => {
    const max = d3.max(props.data, (bin: { bin_start: number; bin_end: number; count: number }) => bin.count) ?? 0;
    return d3.scaleLinear().domain([0, max === 0 ? 1 : max * 1.1]).range([dimensions().marginTop + getInnerHeight(dimensions()), dimensions().marginTop]);
  });
  const xTicks = createMemo(() => xScale().ticks(Math.max(2, Math.floor(getInnerWidth(dimensions()) / 100))));

  return (
    <div class="ui-chart">
      <div class="ui-chart__frame" ref={env.rootRef}>
        <Show when={env.width() > 0 && props.data.length > 0} fallback={<div class="ui-chart__empty">No histogram data available.</div>}>
          <svg viewBox={`0 0 ${dimensions().width} ${dimensions().height}`} class="ui-chart__svg" role="img" aria-label="Histogram">
            <For each={yScale().ticks(4)}>
              {(tick) => (
                <>
                  <line
                    x1={dimensions().marginLeft}
                    x2={dimensions().marginLeft + getInnerWidth(dimensions())}
                    y1={yScale()(tick)}
                    y2={yScale()(tick)}
                    stroke={theme().border}
                    stroke-dasharray="3 4"
                  />
                  <text x={dimensions().marginLeft - 8} y={yScale()(tick)} fill={theme().textMuted} text-anchor="end" dominant-baseline="middle" class="ui-chart__tick">
                    {formatCompactNumber(tick)}
                  </text>
                </>
              )}
            </For>

            <For each={props.data}>
              {(bin) => (
                <rect
                  x={xScale()(bin.bin_start) + 1}
                  y={yScale()(bin.count)}
                  width={Math.max(2, xScale()(bin.bin_end) - xScale()(bin.bin_start) - 2)}
                  height={dimensions().marginTop + getInnerHeight(dimensions()) - yScale()(bin.count)}
                  fill={theme().warning}
                  opacity="0.8"
                  rx="2"
                />
              )}
            </For>

            <For each={xTicks()}>
              {(tick) => (
                <text
                  x={xScale()(tick)}
                  y={dimensions().marginTop + getInnerHeight(dimensions()) + 20}
                  fill={theme().textMuted}
                  text-anchor="middle"
                  class="ui-chart__tick"
                >
                  {formatCompactNumber(tick)}
                </text>
              )}
            </For>
          </svg>
        </Show>
      </div>
    </div>
  );
}

interface BoxPlotChartProps {
  data: Array<{ date: string; min: number; q1: number; median: number; q3: number; max: number }>;
  height?: number;
}

export function BoxPlotChart(props: BoxPlotChartProps) {
  const env = createChartEnvironment();
  const theme = createMemo(() => {
    env.themeVersion();
    return readChartTheme();
  });
  const dimensions = createMemo(() => buildChartDimensions(env.width(), props.height ?? 200, 20));
  const points = createMemo(() =>
    props.data
      .map((row) => ({ ...row, parsedDate: parseDate(row.date) }))
      .filter((row): row is ParsedBoxPlotDatum => row.parsedDate instanceof Date)
      .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime())
  );
  const xScale = createMemo(() => {
    const domain = points().map((point) => point.date);
    return d3.scaleBand().domain(domain).range([dimensions().marginLeft, dimensions().marginLeft + getInnerWidth(dimensions())]).padding(0.35);
  });
  const yScale = createMemo(() => {
    const max = d3.max(points(), (point: ParsedBoxPlotDatum) => point.max) ?? 0;
    return d3.scaleLinear().domain([0, max === 0 ? 1 : max * 1.1]).range([dimensions().marginTop + getInnerHeight(dimensions()), dimensions().marginTop]);
  });

  return (
    <div class="ui-chart">
      <div class="ui-chart__frame" ref={env.rootRef}>
        <Show when={env.width() > 0 && points().length > 0} fallback={<div class="ui-chart__empty">No box plot data available.</div>}>
          <svg viewBox={`0 0 ${dimensions().width} ${dimensions().height}`} class="ui-chart__svg" role="img" aria-label="Box plot chart">
            <For each={yScale().ticks(4)}>
              {(tick) => (
                <>
                  <line
                    x1={dimensions().marginLeft}
                    x2={dimensions().marginLeft + getInnerWidth(dimensions())}
                    y1={yScale()(tick)}
                    y2={yScale()(tick)}
                    stroke={theme().border}
                    stroke-dasharray="3 4"
                  />
                  <text x={dimensions().marginLeft - 8} y={yScale()(tick)} fill={theme().textMuted} text-anchor="end" dominant-baseline="middle" class="ui-chart__tick">
                    {formatCompactNumber(tick)}
                  </text>
                </>
              )}
            </For>

            <For each={points()}>
              {(point) => {
                const center = () => (xScale()(point.date) ?? 0) + xScale().bandwidth() / 2;
                return (
                  <>
                    <line x1={center()} x2={center()} y1={yScale()(point.min)} y2={yScale()(point.max)} stroke={theme().textMuted} />
                    <rect
                      x={xScale()(point.date)}
                      y={yScale()(point.q3)}
                      width={xScale().bandwidth()}
                      height={Math.max(2, yScale()(point.q1) - yScale()(point.q3))}
                      fill={theme().accent}
                      opacity="0.25"
                      stroke={theme().accent}
                    />
                    <line x1={xScale()(point.date)} x2={(xScale()(point.date) ?? 0) + xScale().bandwidth()} y1={yScale()(point.median)} y2={yScale()(point.median)} stroke={theme().accent} stroke-width="2" />
                    <text
                      x={center()}
                      y={dimensions().marginTop + getInnerHeight(dimensions()) + 20}
                      fill={theme().textMuted}
                      text-anchor="middle"
                      class="ui-chart__tick"
                    >
                      {formatDate(point.parsedDate)}
                    </text>
                  </>
                );
              }}
            </For>
          </svg>
        </Show>
      </div>
    </div>
  );
}

interface ChartPlaceholderProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function ChartPlaceholder(props: ChartPlaceholderProps) {
  return (
    <div class="ui-chart__empty">
      <span>{props.message}</span>
      <Show when={props.actionLabel && props.onAction}>
        <Button onClick={() => props.onAction?.()}>{props.actionLabel}</Button>
      </Show>
    </div>
  );
}
