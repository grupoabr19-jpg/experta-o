function parseCsvLine(line) {
  const values = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value.trim()); value = '';
    } else value += character;
  }
  values.push(value.trim());
  return values;
}

function number(value) {
  if (value === '' || value == null) return null;
  const text = String(value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function tons(value) {
  return value == null ? null : Number((value / 1000).toFixed(6));
}

function percentage(value) {
  const parsed = number(value);
  if (parsed == null) return null;
  return String(value).includes('%') ? parsed : parsed * 100;
}

function rowsFromCsv(text) {
  return String(text).replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(parseCsvLine);
}

function rankedRows(text) {
  return rowsFromCsv(text).filter(row => /^\d+$/.test(row[0] || ''));
}

function sellerRankingFromCsv(text) {
  return rankedRows(text).map(row => ({
    id: `seller-${row[0]}`,
    position: Number(row[0]),
    name: row[1],
    route: row[2],
    role: row[3],
    salesAmount: null,
    targetAmount: null,
    challengeTargetAmount: null,
    tons: tons(number(row[8])),
    targetTons: tons(number(row[4])),
    challengeTargetTons: null,
    attainment: percentage(row[9]),
    status: row[10] || ''
  })).filter(item => item.name && item.tons != null && item.targetTons != null && item.attainment != null);
}

function teamRankingFromCsv(text) {
  return rankedRows(text).map(row => ({
    id: `team-${row[0]}`,
    position: Number(row[0]),
    name: row[1],
    route: row[1],
    role: 'Equipe',
    salesAmount: null,
    targetAmount: null,
    challengeTargetAmount: null,
    tons: tons(number(row[3])),
    targetTons: tons(number(row[2])),
    challengeTargetTons: null,
    attainment: percentage(row[4]),
    status: row[7] || ''
  })).filter(item => item.name && item.tons != null && item.targetTons != null && item.attainment != null);
}

function rankingFromSpreadsheetCsv(sellerText, teamText) {
  const sellers = sellerRankingFromCsv(sellerText);
  const teams = teamRankingFromCsv(teamText);
  if (!sellers.length && !teams.length) throw new Error('Nenhum ranking encontrado nas abas da planilha');
  return {
    updatedAt: new Date().toISOString(),
    period: 'Período atual',
    management: { generalManager: 'Marcelo', salesManager: 'Anderson', salesSupervisor: 'Rafael Pereira' },
    teams,
    sellers,
    source: 'spreadsheet'
  };
}

module.exports = { rankingFromSpreadsheetCsv };