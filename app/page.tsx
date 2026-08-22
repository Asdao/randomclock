const dateSlots = ['_', '_', '·', '_', '_', '·', '_', '_'];
const timeSlots = ['_', '_', ':', '_', '_'];

export default function Home() {
  return (
    <main className="time-page">
      <section className="time-display" aria-labelledby="time-title">
        <p className="eyebrow">time in</p>
        <h1 id="time-title">from now</h1>

        <div className="date-time" aria-label="Blank date and time fields">
          <div className="slot-group" aria-label="Date, day month year">
            {dateSlots.map((slot, index) => (
              <span
                className={slot === '·' ? 'separator' : 'slot'}
                key={`date-${index}`}
                aria-hidden="true"
              >
                {slot}
              </span>
            ))}
          </div>
          <span className="group-gap" aria-hidden="true" />
          <div className="slot-group" aria-label="Time, hours and minutes">
            {timeSlots.map((slot, index) => (
              <span
                className={slot === ':' ? 'separator' : 'slot'}
                key={`time-${index}`}
                aria-hidden="true"
              >
                {slot}
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
