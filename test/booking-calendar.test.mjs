import test from 'node:test'
import assert from 'node:assert/strict'

import { buildBookingCalendarMonth, buildTimeSlots } from '../src/lib/booking-calendar.ts'

test('buildBookingCalendarMonth creates a full month grid with current-month metadata', () => {
    const cells = buildBookingCalendarMonth({
        currentMonth: new Date('2026-03-01T12:00:00.000Z'),
        today: new Date('2026-03-10T12:00:00.000Z'),
        selectedDate: '2026-03-18',
    })

    assert.equal(cells.length, 42)
    assert.deepEqual(cells[0], {
        isoDate: '2026-03-01',
        dayOfMonth: 1,
        isCurrentMonth: true,
        isPast: true,
        isSelected: false,
        isToday: false,
    })

    const selectedCell = cells.find((cell) => cell.isoDate === '2026-03-18')

    assert.deepEqual(selectedCell, {
        isoDate: '2026-03-18',
        dayOfMonth: 18,
        isCurrentMonth: true,
        isPast: false,
        isSelected: true,
        isToday: false,
    })
})

test('buildTimeSlots creates evenly spaced slots within availability window', () => {
    const slots = buildTimeSlots('09:00', '11:00', 30)

    assert.deepEqual(slots, ['09:00', '09:30', '10:00', '10:30'])
})
