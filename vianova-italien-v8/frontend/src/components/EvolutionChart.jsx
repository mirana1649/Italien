import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const COLORS = { exercise: '#008C45', listening: '#7A8780', oral: '#CD212A' };
const LABELS = { exercise: 'Exercice', listening: 'Écoute', oral: 'Oral' };

// history = [{date, kind, score}] -> une ligne par activité (vert, or, rouge)
export default function EvolutionChart({ history }) {
  if (!history?.length) return <p className="muted">La courbe apparaîtra après votre première activité.</p>;
  const byDate = [];
  history.forEach((h) => {
    let row = byDate.find((r) => r.date === h.date);
    if (!row) byDate.push((row = { date: h.date }));
    row[h.kind] = Number(h.score);
  });
  return (
    <div style={{ height: 250 }}>
      <ResponsiveContainer>
        <LineChart data={byDate} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="#8884" strokeDasharray="4 4" />
          <XAxis dataKey="date" fontSize={12} /><YAxis domain={[0, 25]} fontSize={12} />
          <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #CDD3CA' }} formatter={(v, name) => [`${v}/${name === 'Oral' ? 22 : 25}`, name]} /><Legend />
          {Object.keys(COLORS).map((k) => <Line key={k} name={LABELS[k]} dataKey={k} stroke={COLORS[k]} strokeWidth={3} connectNulls dot={{ r: 5, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 7 }} animationDuration={1200} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
