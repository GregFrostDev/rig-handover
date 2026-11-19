import type { DigestRow, Night } from '../digest/types.js';

// Missing data renders as "—" (styleguide). Times are shown exactly as the log wrote them.
const dash = () => <span class="mute">—</span>;

function DigestRowView({ row }: { row: DigestRow }) {
  const warn = row.retries >= 3 || row.lastStatus === 'fail';
  return (
    <tr class={warn ? 'warn' : undefined}>
      <td>{row.job}</td>
      <td>{row.owner ?? dash()}</td>
      <td>{row.runs}</td>
      <td>{row.retries}</td>
      <td>{row.lastStatus}</td>
      <td>{row.lastError ?? dash()}</td>
      <td>{row.firstAt}</td>
      <td>{row.lastAt}</td>
    </tr>
  );
}

export function DigestView({ result }: { result: Extract<Night, { found: true }> }) {
  return (
    <>
      <h1>digest {result.night}</h1>
      {result.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row) => (
              <DigestRowView row={row} />
            ))}
          </tbody>
        </table>
      )}
      {result.badLines > 0 ? (
        <p class="warn">
          {result.badLines} {result.badLines === 1 ? 'line' : 'lines'} could not be read
        </p>
      ) : null}
    </>
  );
}

export function NoRunLog({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="warn">no run log for {night}</p>
    </>
  );
}
