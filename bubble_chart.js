/**
 * bubble_chart.js
 *
 * Reads a pre-loaded CSV file and renders a Highcharts bubble chart.
 *
 * Assumptions
 * -----------
 * - Highcharts is already loaded on the page (e.g. via a <script> tag).
 * - The CSV is fetched separately and its text is passed to `initChart(csvText)`.
 *   See the integration snippet at the bottom for a typical usage pattern.
 *
 * CSV column layout (JS indexed)
 * ─────────────────────────────
 *  0  group        – ignored here
 *  1  series       – colour/series grouping  (e.g. "Group A")
 *  2  occupation   – point label / tooltip name
 *  3  median_wage  – y axis
 *  4  net_change   – IGNORE
 *  5  current_jobs   – bubble size (z value)
 *  6  SOC          – ignored here
 *  7  annualized_change    – new x-axis
 *  8  job_change_note      -- hopefully feed into tooltip
 */

// ─── Colour palette (one colour per series) ──────────────────────────────────
const SERIES_COLORS = [
  // Currently in order across 3 categories. Comment out to coordinate
  
  //"#3f5bbf", // Apprenticeship
  "#e76e68", // Long-term on-the-job training 
  "#ffbe46", // Moderate-term on-the-job training
  "#94c747", // None
  "#b371c1", // Short-term on-the-job training  
  "#0891b2", // extra... 
];

/**
 * Parse CSV text into a map of  seriesName → [{ name, x, y, z }, …]
 *
 * @param {string} csvText  Raw CSV string (including header row).
 * @returns {Map<string, Array>}
 */
function parseCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);

  // Skip the header row
  const dataLines = lines.slice(1);

  const seriesMap = new Map(); // preserves insertion order

  for (const line of dataLines) {
    if (!line.trim()) continue;

    // Handle quoted fields that may contain commas
    const cols = parseCsvLine(line);

    const seriesName  = cols[1]?.trim();
    const occupation  = cols[2]?.trim();
    const medianWage  = parseFloat(cols[3]);
    const netChange   = parseFloat(cols[4]);
    const currentJobs   = parseFloat(cols[5]);
    const annualizedRate   = parseFloat(cols[7]);
    const jobChangeNote  = cols[8]?.trim();

    //console.log(jobChangeNote); 

    // Skip rows with missing / invalid values
    if (!seriesName || isNaN(medianWage) || isNaN(netChange) || isNaN(annualizedRate) || isNaN(currentJobs)) {
      continue;
    }

    if (!seriesMap.has(seriesName)) {
      seriesMap.set(seriesName, []);
    }

    seriesMap.get(seriesName).push({
      name: occupation || "",
      x: annualizedRate,
      y: medianWage,
      z: currentJobs,
      jobChangeNote: jobChangeNote || "",  
    });
  }

  return seriesMap;
}

/**
 * Minimal RFC-4180-aware CSV line splitter that handles quoted fields.
 *
 * @param {string} line
 * @returns {string[]}
 */
function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") or end of quoted field
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(field);
        field = "";
      } else {
        field += ch;
      }
    }
  }
  fields.push(field); // push the last field
  return fields;
}

/**
 * Convert the parsed series map into the Highcharts series array format.
 *
 * @param {Map<string, Array>} seriesMap
 * @returns {Array}
 */
function buildHighchartsSeries(seriesMap) {
  const seriesArray = [];
  let colorIndex = 0;

  for (const [name, data] of seriesMap) {
    seriesArray.push({
      name,
      color: SERIES_COLORS[colorIndex % SERIES_COLORS.length],
      data,
    });
    colorIndex++;
  }

  return seriesArray;
}

/**
 * Render the Highcharts bubble chart inside `containerId`.
 *
 * @param {string}  csvText      Raw CSV text.
 * @param {string}  containerId  ID of the DOM element to render into.
 */
function initChart(csvText, containerId = "chart-container") {
  const seriesMap = parseCsv(csvText);
  const series    = buildHighchartsSeries(seriesMap);

  Highcharts.chart(containerId, {
    chart: {
      type: "bubble",
      plotBorderWidth: 1,
      zooming: { type: "xy" },
    },

    title: {
      text: null, // "Slow Growth, High Quality Occupational Sectors: Installation, Maintenance, and Repair",
    }, 

    subtitle: {
      text: "Bubble size reflects current number of jobs (2022).",
    },

    legend: {
      enabled: true,
    },

    accessibility: {
      point: {
        valueDescriptionFormat:
          "{index}. {point.name}: Median wage ${point.y:,.0f}, " +
          "net change {point.x}, total jobs {point.z}.",
      },
    },

    xAxis: {
      title: { text: "Employment Growth Rate (Annual)" },
      labels: {
       // formatter() {
       //   return Highcharts.numberFormat(this.value, 0, ".", ",");
       // },
        formatter() {
          return Highcharts.numberFormat(this.value, 2) + "%";
        },
      },
     plotLines: [
        {
          value: 0,
          color: "#999",
          width: 1,
         dashStyle: "Solid",
          zIndex: 3,
        },
      ],
    },

     yAxis: {
      title: { text: "Median Wage ($)" },
      labels: {
        formatter() {
          return "$" + Highcharts.numberFormat(this.value, 0, ".", ",");
        },
      },
      gridLineWidth: 0,
      plotLines: [
        {
          value: 64590,
          label: {
            align: 'right',
            style: { fontStyle: 'italic' },
            text: 'Citywide Median Wage ($64,590)',
            x: 0.5
            },
          color: "#999",
          width: 1,
          dashStyle: "dot",
          zIndex: 3,
        },
      ],
    },
    
    tooltip: {
      useHTML: true,
      // headerFormat: "On the job training: <b>{series.name}</b><br>",
      pointFormatter() {
        return (
          `Occupation: <b>${this.name}</b><br>` +
          `Employment Growth Rate (Annual): <b>${Highcharts.numberFormat(this.x, 2)}%</b><br>` +
          // `Projected 10-year Net Change: <b>${Highcharts.numberFormat(this.x, 0, ".", ",")}</b><br>` +
          `Median Wage: <b>$${Highcharts.numberFormat(this.y, 0, ".", ",")}</b><br>` +
          `Total Current Jobs: <b>${Highcharts.numberFormat(this.z, 0, ".", ",")}</b><br>` +
          (this.jobChangeNote ? `<br><i>Jobs for &quot;${this.name}&quot; are expected to ${this.jobChangeNote}</i>` : "")  // ← add this line
        );
      },
      style: {
        width: '400px'  // Set your desired max width
      }
    },

    plotOptions: {
      bubble: {
        // Scale bubble sizes; tweak minSize/maxSize to taste
        minSize: 8,
        maxSize: 60,
        marker: { fillOpacity: 0.65 },
        dataLabels: {
          enabled: false, // flip to true to show occupation names on chart
          format: "{point.name}",
          style: { fontSize: "9px" },
        },
      },
    },

    series,

    credits: { enabled: false },
  });
}

