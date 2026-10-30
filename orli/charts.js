const KIND_COLORS = {
  explicit_question: "#4f5e56",
  implicit_information_request: "#6e8b74",
  request_for_action: "#8b6f5a",
  follow_up_question: "#c4a484",
};
const FALLBACK_COLORS = ["#4f5e56", "#8b6f5a", "#6e8b74", "#c4a484", "#3e4c46", "#a6846a"];

function kindColor(key, index) {
  return KIND_COLORS[key] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function svgEl(name, attrs) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [key, value] of Object.entries(attrs || {})) {
    node.setAttribute(key, value);
  }
  return node;
}

function showExamples(host, title, examples) {
  host.hidden = false;
  host.replaceChildren();
  const kicker = document.createElement("p");
  kicker.className = "examples-kicker";
  const count = examples.length;
  const word = count === 1 ? "resultado" : "resultados";
  kicker.textContent = count
    ? title + " · " + count + " " + word
    : title;
  host.appendChild(kicker);
  if (!count) {
    const empty = document.createElement("p");
    empty.className = "chart-empty";
    empty.textContent = "No hay resultados de este caso.";
    host.appendChild(empty);
    return;
  }
  for (const example of examples) {
    const article = document.createElement("article");
    article.className = "example";
    if (example.meta) {
      const meta = document.createElement("p");
      meta.className = "example-meta";
      meta.textContent = example.meta;
      article.appendChild(meta);
    }
    for (const line of example.lines || []) {
      const block = document.createElement("div");
      block.className = "example-block";
      const label = document.createElement("p");
      label.className = "example-label";
      label.textContent = [line.label, line.who, line.time].filter(Boolean).join(" · ");
      const text = document.createElement("p");
      text.className = "example-text";
      text.textContent = line.text || "";
      block.appendChild(label);
      block.appendChild(text);
      article.appendChild(block);
    }
    host.appendChild(article);
  }
}

function bindPick(figure, el, host, title, examples, key) {
  el.classList.add("chart-hit");
  el.dataset.pick = key;
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", title);
  const activate = (event) => {
    if (event) event.stopPropagation();
    document.querySelectorAll(".examples").forEach((node) => {
      if (node === host || node.hidden) return;
      node.hidden = true;
      node.replaceChildren();
      const other = node.closest(".chart");
      if (other) other.querySelectorAll(".is-selected").forEach((selected) => selected.classList.remove("is-selected"));
    });
    figure.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
    figure.querySelectorAll('[data-pick="' + key + '"]').forEach((node) => node.classList.add("is-selected"));
    showExamples(host, title, examples || []);
  };
  el.addEventListener("click", activate);
  el.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activate();
    }
  });
}

function legendButton(figure, host, title, examples, key, color) {
  const button = document.createElement("button");
  button.type = "button";
  if (color) {
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = color;
    button.appendChild(swatch);
  }
  button.append(title);
  bindPick(figure, button, host, title, examples, key);
  return button;
}

function chartFigure(spec) {
  const figure = document.createElement("figure");
  figure.className = "chart";
  const caption = document.createElement("figcaption");
  const title = document.createElement("h2");
  title.textContent = spec.title;
  caption.appendChild(title);
  if (spec.note) {
    const note = document.createElement("p");
    note.className = "hint";
    note.textContent = spec.note;
    caption.appendChild(note);
  }
  const plot = document.createElement("div");
  plot.className = "chart-plot";
  const examples = document.createElement("div");
  examples.className = "examples";
  examples.hidden = true;
  examples.setAttribute("aria-live", "polite");
  figure.appendChild(caption);
  figure.appendChild(plot);
  figure.appendChild(examples);
  return { figure, plot, examples };
}

function emptyNote(plot, text) {
  const note = document.createElement("p");
  note.className = "chart-empty";
  note.textContent = text;
  plot.appendChild(note);
}

function renderBars(figure, plot, host, bars) {
  if (!bars.length) {
    emptyNote(plot, "No hay datos para esta gráfica.");
    return;
  }
  const labelW = 228;
  const width = 720;
  const rowH = 34;
  const max = Math.max(...bars.map((bar) => bar.count), 1);
  const barMax = width - labelW - 36;
  const height = bars.length * rowH + 8;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  bars.forEach((bar, index) => {
    const y = index * rowH + 4;
    const barW = Math.max(4, (bar.count / max) * barMax);
    const hit = svgEl("rect", {
      x: 0, y, width, height: rowH - 6, fill: "transparent", class: "row-hit",
    });
    const rect = svgEl("rect", {
      x: labelW,
      y: y + 4,
      width: barW,
      height: 18,
      rx: 4,
      fill: "#4f5e56",
    });
    const label = svgEl("text", {
      x: labelW - 10,
      y: y + 18,
      "text-anchor": "end",
      fill: "#2c2824",
      "font-size": "13",
    });
    label.textContent = bar.label;
    const value = svgEl("text", {
      x: labelW + barW + 8,
      y: y + 18,
      fill: "#7a7268",
      "font-size": "12",
    });
    value.textContent = String(bar.count);
    const title = bar.label + " · " + bar.count;
    bindPick(figure, hit, host, title, bar.examples, "bar-" + bar.key);
    svg.append(rect, label, value, hit);
  });
  plot.appendChild(svg);
}

function renderStacked(figure, plot, host, spec) {
  const rows = spec.rows || [];
  if (!rows.length) {
    emptyNote(plot, "No hay datos para esta gráfica.");
    return;
  }
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  (spec.series || []).forEach((series, index) => {
    const item = document.createElement("span");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = kindColor(series.key, index);
    item.append(swatch, series.short || series.label);
    legend.appendChild(item);
  });
  plot.appendChild(legend);

  const labelW = 228;
  const width = 720;
  const rowH = 34;
  const max = Math.max(...rows.map((row) => row.total), 1);
  const barMax = width - labelW - 36;
  const height = rows.length * rowH + 8;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  rows.forEach((row, index) => {
    const y = index * rowH + 4;
    const label = svgEl("text", {
      x: labelW - 10,
      y: y + 18,
      "text-anchor": "end",
      fill: "#2c2824",
      "font-size": "13",
    });
    label.textContent = row.label;
    const full = svgEl("title", {});
    full.textContent = row.label;
    label.appendChild(full);
    svg.appendChild(label);
    let x = labelW;
    (row.segments || []).forEach((segment, segmentIndex) => {
      const segW = Math.max(6, (segment.count / max) * barMax);
      const rect = svgEl("rect", {
        x, y: y + 4, width: segW, height: 18, rx: 3,
        fill: kindColor(segment.key, segmentIndex),
      });
      const title = row.label + " · " + segment.label + " · " + segment.count;
      bindPick(figure, rect, host, title, segment.examples, row.key + "-" + segment.key);
      svg.appendChild(rect);
      x += segW + 2;
    });
    const value = svgEl("text", {
      x: x + 6,
      y: y + 18,
      fill: "#7a7268",
      "font-size": "12",
    });
    value.textContent = String(row.total);
    svg.appendChild(value);
  });
  plot.appendChild(svg);
}

function arcPath(cx1, cx2, cy, r, which) {
  const d = cx2 - cx1;
  const h = Math.sqrt(Math.max(0, r * r - (d / 2) * (d / 2)));
  const mx = (cx1 + cx2) / 2;
  const top = mx + " " + (cy - h);
  const bot = mx + " " + (cy + h);
  if (which === "left") {
    return `M ${top} A ${r} ${r} 0 1 0 ${bot} A ${r} ${r} 0 0 1 ${top} Z`;
  }
  if (which === "right") {
    return `M ${top} A ${r} ${r} 0 1 1 ${bot} A ${r} ${r} 0 0 0 ${top} Z`;
  }
  return `M ${top} A ${r} ${r} 0 0 1 ${bot} A ${r} ${r} 0 0 1 ${top} Z`;
}

function renderVenn(figure, plot, host, venn) {
  const width = 720;
  const height = 300;
  const cx1 = 210;
  const cx2 = 390;
  const cy = 142;
  const r = 118;
  const svg = svgEl("svg", {
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": venn.note || "Diagrama de Venn",
  });
  const zones = [
    ["without_response", "left", "#4f5e56", 0.38],
    ["with_response", "lens", "#6b6254", 0.5],
    ["judicial_recognition", "right", "#8b6f5a", 0.28],
  ];
  const paths = {
    left: arcPath(cx1, cx2, cy, r, "left"),
    right: arcPath(cx1, cx2, cy, r, "right"),
    lens: arcPath(cx1, cx2, cy, r, "lens"),
  };
  for (const [key, shape, fill, opacity] of zones) {
    const bucket = venn[key] || { label: key, count: 0, examples: [] };
    const path = svgEl("path", {
      d: paths[shape],
      fill,
      "fill-opacity": opacity,
      stroke: "#fbf8f3",
      "stroke-width": "2",
    });
    bindPick(figure, path, host, bucket.label, bucket.examples, key);
    svg.appendChild(path);
  }
  const paraphrase = venn.victim_paraphrase || { label: "Parafraseo", count: 0, examples: [] };
  const judicial = venn.judicial_recognition || { label: "Reconocimiento judicial", count: 0, examples: [] };
  const rightHits = [
    [judicial, "judicial_recognition", cy - 46],
    [paraphrase, "victim_paraphrase", cy + 8],
  ];
  for (const [bucket, key, y] of rightHits) {
    const hit = svgEl("rect", {
      x: cx2 + 4,
      y,
      width: 100,
      height: 54,
      fill: "transparent",
    });
    bindPick(figure, hit, host, bucket.label, bucket.examples, key);
    svg.appendChild(hit);
  }

  const numbers = [
    [cx1 - 46, cy - 4, String((venn.without_response || {}).count || 0), "sin respuesta"],
    [(cx1 + cx2) / 2, cy + 8, String((venn.with_response || {}).count || 0), ""],
    [cx2 + 52, cy - 36, String(judicial.count || 0), "reconocimientos"],
    [cx2 + 52, cy + 28, String(paraphrase.count || 0), "parafraseos"],
  ];
  for (const [x, y, count, caption] of numbers) {
    const value = svgEl("text", {
      x, y, "text-anchor": "middle", fill: "#2c2824", "font-size": "22", "font-weight": "600",
    });
    value.textContent = count;
    svg.appendChild(value);
    if (!caption) continue;
    const sub = svgEl("text", {
      x, y: y + 16, "text-anchor": "middle", fill: "#4a453f", "font-size": "11",
    });
    sub.textContent = caption;
    svg.appendChild(sub);
  }
  plot.appendChild(svg);

  const legend = document.createElement("div");
  legend.className = "venn-legend";
  const entries = [
    ["without_response", "#4f5e56"],
    ["with_response", "#6b6254"],
    ["judicial_recognition", "#8b6f5a"],
    ["victim_paraphrase", "#c4a484"],
  ];
  for (const [key, color] of entries) {
    const bucket = venn[key] || { label: key, count: 0, examples: [] };
    legend.appendChild(legendButton(
      figure,
      host,
      bucket.count + " " + bucket.label,
      bucket.examples,
      key,
      color,
    ));
  }
  plot.appendChild(legend);
}

function piePath(cx, cy, r, start, end) {
  const large = end - start > Math.PI ? 1 : 0;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function renderPie(figure, plot, host, slices) {
  const total = slices.reduce((sum, slice) => sum + (slice.count || 0), 0);
  const width = 720;
  const height = 240;
  const cx = 160;
  const cy = 120;
  const r = 92;
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" });
  const colors = ["#4f5e56", "#c4a484"];
  if (!total) {
    svg.appendChild(svgEl("circle", { cx, cy, r, fill: "#e4d8c8" }));
  } else {
    let angle = -Math.PI / 2;
    slices.forEach((slice, index) => {
      if (!slice.count) return;
      const sweep = (slice.count / total) * Math.PI * 2;
      const path = svgEl("path", { d: piePath(cx, cy, r, angle, angle + sweep), fill: colors[index % colors.length] });
      bindPick(figure, path, host, slice.label, slice.examples, "pie-" + index);
      svg.appendChild(path);
      angle += sweep;
    });
  }
  plot.appendChild(svg);
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  slices.forEach((slice, index) => {
    legend.appendChild(legendButton(
      figure,
      host,
      slice.count + " " + slice.label,
      slice.examples,
      "pie-" + index,
      colors[index % colors.length],
    ));
  });
  plot.appendChild(legend);
}

function renderReportCharts(root, model) {
  root.replaceChildren();
  if (!model || !model.venn) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  const intro = document.createElement("p");
  intro.className = "hint";
  intro.textContent = "Elige una zona de cada gráfica para ver todos los resultados de ese caso.";
  root.appendChild(intro);

  const venn = chartFigure({
    title: "Llamados y respuestas",
    note: model.venn.note,
  });
  renderVenn(venn.figure, venn.plot, venn.examples, model.venn);
  root.appendChild(venn.figure);

  const sections = [
    () => {
      const block = chartFigure(model.call_types || { title: "Tipos de llamado" });
      renderBars(block.figure, block.plot, block.examples, (model.call_types || {}).bars || []);
      return block.figure;
    },
    () => {
      const block = chartFigure(model.callers || { title: "Quiénes llaman" });
      renderBars(block.figure, block.plot, block.examples, (model.callers || {}).bars || []);
      return block.figure;
    },
    () => {
      const block = chartFigure(model.type_by_caller || { title: "Tipo de llamado y quién llama" });
      renderStacked(block.figure, block.plot, block.examples, model.type_by_caller || {});
      return block.figure;
    },
    () => {
      const block = chartFigure(model.patterns || { title: "Patrones de macrocriminalidad" });
      renderBars(block.figure, block.plot, block.examples, (model.patterns || {}).bars || []);
      return block.figure;
    },
    () => {
      const block = chartFigure(model.type_by_pattern || { title: "Tipo de llamado y patrón de macrocriminalidad" });
      renderStacked(block.figure, block.plot, block.examples, model.type_by_pattern || {});
      return block.figure;
    },
    () => {
      const block = chartFigure(model.response_pie || { title: "Llamados con y sin respuesta" });
      renderPie(block.figure, block.plot, block.examples, (model.response_pie || {}).slices || []);
      return block.figure;
    },
    () => {
      const block = chartFigure(model.comparecientes || { title: "Respuestas de comparecientes" });
      renderBars(block.figure, block.plot, block.examples, (model.comparecientes || {}).bars || []);
      return block.figure;
    },
  ];
  for (const build of sections) root.appendChild(build());
}

document.addEventListener("click", (event) => {
  document.querySelectorAll(".examples").forEach((host) => {
    if (host.hidden || host.contains(event.target)) return;
    host.hidden = true;
    host.replaceChildren();
    const figure = host.closest(".chart");
    if (figure) figure.querySelectorAll(".is-selected").forEach((node) => node.classList.remove("is-selected"));
  });
});
