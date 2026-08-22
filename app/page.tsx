'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, FormEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';

type TimeValues = {
  day: string;
  month: string;
  year: string;
  hours: string;
  minutes: string;
};

type TimeDifference = {
  target: Date;
  isPast: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type HistoryEntry = {
  id: string;
  values: TimeValues;
};

type HistoryOffset = {
  x: number;
  y: number;
};

type HistoryDrag = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  orbitAngle: number;
  moved: boolean;
};

const initialValues: TimeValues = {
  day: '',
  month: '',
  year: '',
  hours: '',
  minutes: '',
};

const fieldOrder: Array<keyof TimeValues> = ['day', 'month', 'year', 'hours', 'minutes'];
const lunarCycleDays = 29.530588853;
const lunarReferenceTime = Date.UTC(2000, 0, 6, 18, 14);

function getMoonPhase(date = new Date()) {
  const elapsedDays = (date.getTime() - lunarReferenceTime) / 86_400_000;
  const cyclePosition = (elapsedDays % lunarCycleDays) / lunarCycleDays;
  return cyclePosition < 0 ? cyclePosition + 1 : cyclePosition;
}

function getDifference(values: TimeValues): TimeDifference | null {
  if (Object.values(values).some((value) => value.length === 0)) {
    return null;
  }

  const day = Number(values.day);
  const month = Number(values.month);
  const year = 2000 + Number(values.year);
  const hours = Number(values.hours);
  const minutes = Number(values.minutes);
  const target = new Date(year, month - 1, day, hours, minutes);

  const isValid =
    target.getFullYear() === year &&
    target.getMonth() === month - 1 &&
    target.getDate() === day &&
    target.getHours() === hours &&
    target.getMinutes() === minutes;

  if (!isValid) {
    return null;
  }

  const difference = target.getTime() - Date.now();
  const absoluteDifference = Math.abs(difference);
  const days = Math.floor(absoluteDifference / 86_400_000);
  const hoursLeft = Math.floor((absoluteDifference % 86_400_000) / 3_600_000);
  const minutesLeft = Math.floor((absoluteDifference % 3_600_000) / 60_000);
  const seconds = Math.floor((absoluteDifference % 60_000) / 1_000);

  return {
    target,
    isPast: difference < 0,
    days,
    hours: hoursLeft,
    minutes: minutesLeft,
    seconds,
  };
}

function getInvalidFields(values: TimeValues): Array<keyof TimeValues> {
  const rules: Array<[keyof TimeValues, number, number]> = [
    ['day', 1, 31],
    ['month', 1, 12],
    ['year', 0, 99],
    ['hours', 0, 23],
    ['minutes', 0, 59],
  ];
  const invalidFields = rules
    .filter(([field, minimum, maximum]) => {
      const value = values[field];
      const number = Number(value);
      return value.length === 0 || !Number.isInteger(number) || number < minimum || number > maximum;
    })
    .map(([field]) => field);

  if (invalidFields.length === 0 && getDifference(values) === null) {
    invalidFields.push('day');
  }

  return invalidFields;
}

function formatValue(value: string) {
  return value.padStart(2, '0');
}

function formatTarget(values: TimeValues) {
  return `${formatValue(values.day)} : ${formatValue(values.month)} : ${formatValue(values.year)}   ${formatValue(values.hours)}:${formatValue(values.minutes)}`;
}

function formatHistoryLabel(values: TimeValues) {
  return `${formatValue(values.day)}:${formatValue(values.month)}:${formatValue(values.year)} · ${formatValue(values.hours)}:${formatValue(values.minutes)}`;
}

function HistoryWord({ text }: { text: string }) {
  const midpoint = (text.length - 1) / 2;

  return (
    <span className="history-word" aria-hidden="true">
      {text.split('').map((character, index) => (
        <span
          className={character === ' ' ? 'history-letter history-space' : 'history-letter'}
          key={`${character}-${index}`}
          style={{
            '--letter-index': index,
            '--letter-curve': `${(index - midpoint) * 4}deg`,
            '--letter-lift': `${Math.abs(index - midpoint) * 1.25}px`,
          } as CSSProperties}
        >
          {character === ' ' ? '\u00a0' : character}
        </span>
      ))}
    </span>
  );
}

export default function Home() {
  const [values, setValues] = useState(initialValues);
  const [difference, setDifference] = useState<TimeDifference | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [typingTick, setTypingTick] = useState(0);
  const [invalidFields, setInvalidFields] = useState<Array<keyof TimeValues>>([]);
  const [repulsionCenterX, setRepulsionCenterX] = useState('54%');
  const [repulsionCircleSize, setRepulsionCircleSize] = useState('clamp(420px, 42vw, 560px)');
  const [moonPhase, setMoonPhase] = useState(0);
  const [historyOffsets, setHistoryOffsets] = useState<Record<string, HistoryOffset>>({});
  const [draggingHistoryId, setDraggingHistoryId] = useState<string | null>(null);
  const [hoveringHistoryId, setHoveringHistoryId] = useState<string | null>(null);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const titleWordsRef = useRef<HTMLSpanElement | null>(null);
  const historyDragRef = useRef<HistoryDrag | null>(null);
  const historyDidDragRef = useRef(false);

  useEffect(() => {
    try {
      const storedHistory = window.localStorage.getItem('time-in-history');
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory)) {
          setHistory(parsedHistory.slice(0, 6));
        }
      }
    } catch {
      // Local history is optional; keep the page usable if storage is unavailable.
    } finally {
      setHistoryLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (historyLoaded) {
      window.localStorage.setItem('time-in-history', JSON.stringify(history));
    }
  }, [history, historyLoaded]);

  useEffect(() => {
    const titleWords = titleWordsRef.current;
    if (!titleWords) {
      return;
    }

    const updateRepulsionCenter = () => {
      const bounds = titleWords.getBoundingClientRect();
      if (bounds.width > 0) {
        setRepulsionCenterX(`${bounds.left + bounds.width / 2}px`);
        setRepulsionCircleSize(`${Math.min(560, Math.max(420, bounds.width * 1.08))}px`);
      }
    };

    updateRepulsionCenter();
    window.addEventListener('resize', updateRepulsionCenter);
    const observer = new ResizeObserver(updateRepulsionCenter);
    observer.observe(titleWords);

    return () => {
      window.removeEventListener('resize', updateRepulsionCenter);
      observer.disconnect();
    };
  }, [typingTick]);

  useEffect(() => {
    const updateMoonPhase = () => setMoonPhase(getMoonPhase());
    updateMoonPhase();
    const timer = window.setInterval(updateMoonPhase, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!showResults) {
      return;
    }

    const refreshDifference = () => setDifference(getDifference(values));
    refreshDifference();
    const timer = window.setInterval(refreshDifference, 1000);

    return () => window.clearInterval(timer);
  }, [showResults, values]);

  const updateValue = (field: keyof TimeValues, maxLength: number, nextIndex?: number) => (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const nextValue = event.target.value.replace(/\D/g, '').slice(0, maxLength);
    setInvalidFields((currentFields) => currentFields.filter((currentField) => currentField !== field));
    setTypingTick((currentTick) => currentTick + 1);
    setValues((currentValues) => ({ ...currentValues, [field]: nextValue }));

    if (nextValue.length === maxLength && nextIndex !== undefined) {
      requestAnimationFrame(() => inputRefs.current[nextIndex]?.focus());
    }
  };

  const handleFieldKeyDown = (index: number) => (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === 'Backspace' && event.currentTarget.value === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextDifference = getDifference(values);
    const nextInvalidFields = getInvalidFields(values);
    setDifference(nextDifference);
    setInvalidFields(nextInvalidFields);

    if (!nextDifference) {
      setShowResults(false);
      const firstInvalidField = nextInvalidFields[0];
      const firstInvalidIndex = firstInvalidField ? fieldOrder.indexOf(firstInvalidField) : -1;
      requestAnimationFrame(() => {
        const input = firstInvalidIndex >= 0 ? inputRefs.current[firstInvalidIndex] : null;
        if (!input) {
          return;
        }

        input.focus({ preventScroll: true });
        input.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        input.setSelectionRange(0, input.value.length);
      });
      return;
    }

    setHistory((currentHistory) => [
      { id: `${Date.now()}-${formatHistoryLabel(values)}`, values: { ...values } },
      ...currentHistory.filter((entry) => formatHistoryLabel(entry.values) !== formatHistoryLabel(values)),
    ].slice(0, 6));
    setShowResults(true);
  };

  const clearForm = () => {
    setValues(initialValues);
    setDifference(null);
    setInvalidFields([]);
    setShowResults(false);
    requestAnimationFrame(() => inputRefs.current[0]?.focus());
  };

  const restoreHistory = (entry: HistoryEntry) => {
    setValues(entry.values);
    setDifference(getDifference(entry.values));
    setShowResults(true);
  };

  const handleHistoryPointerDown = (entryId: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return;
    }

    const origin = historyOffsets[entryId] ?? { x: 0, y: 0 };
    const transform = window.getComputedStyle(event.currentTarget.parentElement ?? event.currentTarget).transform;
    const matrixValues = transform.match(/^matrix\(([^)]+)\)$/)?.[1].split(',').map(Number);
    const orbitAngle = matrixValues ? Math.atan2(matrixValues[1], matrixValues[0]) + Math.PI / 2 : Math.PI / 2;
    historyDragRef.current = {
      id: entryId,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: origin.x,
      originY: origin.y,
      orbitAngle,
      moved: false,
    };
    setDraggingHistoryId(entryId);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleHistoryPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = historyDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const titleBounds = titleWordsRef.current?.getBoundingClientRect();
    const fieldCenterX = titleBounds && titleBounds.width > 0
      ? titleBounds.left + titleBounds.width / 2
      : window.innerWidth * 0.54;
    const fieldCenterY = window.innerHeight * 0.5;
    const fieldRadius = Math.min(340, Math.max(190, window.innerWidth * 0.34));
    const pointerDistance = Math.hypot(event.clientX - fieldCenterX, event.clientY - fieldCenterY);
    const repulsion = Math.max(0, fieldRadius - pointerDistance);
    const directionX = (event.clientX - fieldCenterX) / (pointerDistance || 1);
    const directionY = (event.clientY - fieldCenterY) / (pointerDistance || 1);
    const repelledX = event.clientX + directionX * repulsion;
    const repelledY = event.clientY + directionY * repulsion;
    const screenDeltaX = repelledX - drag.startX;
    const screenDeltaY = repelledY - drag.startY;
    const cosine = Math.cos(drag.orbitAngle);
    const sine = Math.sin(drag.orbitAngle);
    const localDeltaX = screenDeltaX * cosine + screenDeltaY * sine;
    const localDeltaY = -screenDeltaX * sine + screenDeltaY * cosine;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4) {
      drag.moved = true;
      historyDidDragRef.current = true;
    }

    if (drag.moved) {
      setHistoryOffsets((currentOffsets) => ({
        ...currentOffsets,
        [drag.id]: {
          x: drag.originX + localDeltaX,
          y: drag.originY + localDeltaY,
        },
      }));
    }
  };

  const handleHistoryPointerUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (historyDragRef.current?.pointerId === event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      historyDragRef.current = null;
      setDraggingHistoryId(null);
    }
  };

  const handleHistoryClick = (entry: HistoryEntry) => {
    if (historyDidDragRef.current) {
      historyDidDragRef.current = false;
      return;
    }
    restoreHistory(entry);
  };

  const pageTone = difference ? (difference.isPast ? 'is-past' : 'is-future') : '';

  return (
    <main className={`time-page ${pageTone}`}>
      <div
        className="history-orbit"
        aria-label="Recent time differences"
        style={{
          '--history-density': Math.min(0.3, 0.06 + history.length * 0.04),
          '--repulsion-center-x': repulsionCenterX,
          '--repulsion-circle-size': repulsionCircleSize,
          '--moon-angle': `${moonPhase * 360}deg`,
        } as CSSProperties}
      >
        <div className="moon-orbit" aria-hidden="true">
          <span className="moon-dot" />
        </div>
        {history.length > 0 && (
          <div className={`history-ring ${draggingHistoryId ? 'is-dragging' : ''} ${hoveringHistoryId ? 'is-paused' : ''}`}>
            {history.map((entry, index) => {
              const angle = -90 + (index * 360) / Math.max(history.length, 1);
              const offset = historyOffsets[entry.id] ?? { x: 0, y: 0 };
              const entryDifference = getDifference(entry.values);
              const historySize = `${Math.max(0.72, 1.22 - index * 0.09)}rem`;
              const historyWeight = Math.max(500, 900 - index * 80);
              const orbitStyle = {
                '--orbit-angle': `${angle}deg`,
                '--orbit-counter-angle': `${-angle}deg`,
                '--orbit-radius': 'clamp(330px, 40vw, 580px)',
                '--orbit-duration': '34s',
                '--drag-x': `${offset.x}px`,
                '--drag-y': `${offset.y}px`,
              } as CSSProperties;

              return (
                <div className="history-planet" key={entry.id} style={orbitStyle}>
                  <button
                    aria-label={`Open ${formatHistoryLabel(entry.values)}`}
                    className={`history-chip ${entryDifference?.isPast ? 'history-past' : 'history-future'} ${draggingHistoryId === entry.id ? 'is-dragging' : ''}`}
                    onClick={() => handleHistoryClick(entry)}
                    onPointerCancel={handleHistoryPointerUp}
                    onPointerDown={handleHistoryPointerDown(entry.id)}
                    onPointerMove={handleHistoryPointerMove}
                    onPointerUp={handleHistoryPointerUp}
                    onMouseEnter={() => setHoveringHistoryId(entry.id)}
                    onMouseLeave={() => setHoveringHistoryId(null)}
                    style={{
                      '--drag-x': `${offset.x}px`,
                      '--drag-y': `${offset.y}px`,
                      '--history-size': historySize,
                      '--history-weight': historyWeight,
                    } as CSSProperties}
                    type="button"
                  >
                    <HistoryWord text={formatHistoryLabel(entry.values)} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <section className="time-display" aria-labelledby="time-title">
        <h1 id="time-title">
          <span className="title-words" ref={titleWordsRef}>
            from <span className="now-word" key={typingTick}>now</span><span className="end-dot" aria-hidden="true">.</span>
          </span>
        </h1>

        <form className="time-form" onSubmit={handleSubmit}>
          <div className="date-time" aria-label="Enter a date and time">
            <div className="slot-group" aria-label="Date, day month year">
              <label className={`field-wrap ${invalidFields.includes('day') ? 'is-invalid' : ''}`}>
                <span className="field-label">day</span>
                <input
                  aria-invalid={invalidFields.includes('day')}
                  aria-label="Day"
                  className="date-input"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={updateValue('day', 2, 1)}
                  onKeyDown={handleFieldKeyDown(0)}
                  placeholder="__"
                  ref={(element) => { inputRefs.current[0] = element; }}
                  value={values.day}
                />
                {invalidFields.includes('day') && <span className="field-error">invalid day</span>}
              </label>
              <span className="separator" aria-hidden="true">:</span>
              <label className={`field-wrap ${invalidFields.includes('month') ? 'is-invalid' : ''}`}>
                <span className="field-label">month</span>
                <input
                  aria-invalid={invalidFields.includes('month')}
                  aria-label="Month"
                  className="date-input"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={updateValue('month', 2, 2)}
                  onKeyDown={handleFieldKeyDown(1)}
                  placeholder="__"
                  ref={(element) => { inputRefs.current[1] = element; }}
                  value={values.month}
                />
                {invalidFields.includes('month') && <span className="field-error">invalid month</span>}
              </label>
              <span className="separator" aria-hidden="true">:</span>
              <label className={`field-wrap ${invalidFields.includes('year') ? 'is-invalid' : ''}`}>
                <span className="field-label">year</span>
                <input
                  aria-invalid={invalidFields.includes('year')}
                  aria-label="Year"
                  className="date-input"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={updateValue('year', 2, 3)}
                  onKeyDown={handleFieldKeyDown(2)}
                  placeholder="__"
                  ref={(element) => { inputRefs.current[2] = element; }}
                  value={values.year}
                />
                {invalidFields.includes('year') && <span className="field-error">invalid year</span>}
              </label>
            </div>
            <span className="group-gap" aria-hidden="true" />
            <div className="slot-group" aria-label="Time, hours and minutes">
              <label className={`field-wrap ${invalidFields.includes('hours') ? 'is-invalid' : ''}`}>
                <span className="field-label">hours</span>
                <input
                  aria-invalid={invalidFields.includes('hours')}
                  aria-label="Hours"
                  className="date-input"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={updateValue('hours', 2, 4)}
                  onKeyDown={handleFieldKeyDown(3)}
                  placeholder="__"
                  ref={(element) => { inputRefs.current[3] = element; }}
                  value={values.hours}
                />
                {invalidFields.includes('hours') && <span className="field-error">invalid hours</span>}
              </label>
              <span className="separator" aria-hidden="true">:</span>
              <label className={`field-wrap ${invalidFields.includes('minutes') ? 'is-invalid' : ''}`}>
                <span className="field-label">minutes</span>
                <input
                  aria-invalid={invalidFields.includes('minutes')}
                  aria-label="Minutes"
                  className="date-input"
                  inputMode="numeric"
                  maxLength={2}
                  onChange={updateValue('minutes', 2)}
                  onKeyDown={handleFieldKeyDown(4)}
                  placeholder="__"
                  ref={(element) => { inputRefs.current[4] = element; }}
                  value={values.minutes}
                />
                {invalidFields.includes('minutes') && <span className="field-error">invalid minutes</span>}
              </label>
            </div>
          </div>
          <div className="form-actions">
            <button className="clear-button" type="button" onClick={clearForm}>
              clear
            </button>
            <button className="enter-button" type="submit" aria-label="Show time difference">
              enter
            </button>
          </div>
        </form>
      </section>

      {showResults && (
        <div className="results-layer" role="dialog" aria-modal="true" aria-labelledby="results-title">
          <section className="results-card">
            <div className="results-topline">
              <button className="close-results" type="button" onClick={() => setShowResults(false)}>
                ×
              </button>
            </div>

            <div className="result-heading">
              <h2 id="results-title">
                {difference ? (difference.isPast ? 'since' : 'until') : 'set a time'}
              </h2>
              <p className="result-target">{formatTarget(values)}</p>
            </div>

            {difference ? (
              <div className={`${'difference-grid'} ${difference.isPast ? 'metric-past' : 'metric-future'}`} key={`${difference.days}-${difference.hours}-${difference.minutes}-${difference.seconds}`}>
                <div className="difference-value">
                  <strong>{difference.days}</strong>
                  <span>days</span>
                </div>
                <div className="difference-value">
                  <strong>{difference.hours}</strong>
                  <span>hours</span>
                </div>
                <div className="difference-value">
                  <strong>{difference.minutes}</strong>
                  <span>minutes</span>
                </div>
                <div className="difference-value">
                  <strong>{difference.seconds}</strong>
                  <span>seconds</span>
                </div>
              </div>
            ) : (
              <p className="result-hint">Enter a valid date and time.</p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
