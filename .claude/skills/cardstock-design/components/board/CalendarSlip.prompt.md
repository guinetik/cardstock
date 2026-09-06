Use `CalendarSlip` on the calendar's corkboard month and in its unscheduled tray. The default stock is canary post-it, so a slip reads against the white day sheet on its own.

```jsx
<div className="calendar-day" data-today="true">
  <div className="calendar-day-body">
    <span className="calendar-day-num">12</span>
    <div className="calendar-pack">
      <CalendarSlip id="10" shape="stub" tilt={-2} />
      <CalendarSlip id="3" shape="stub" tilt={1.5} tint="amber" />
    </div>
  </div>
</div>
<div className="calendar-tray">
  <h2>Unscheduled</h2>
  <div className="calendar-tray-list"><CalendarSlip id="5" title="Should trials require a card?" board="backlog" /></div>
</div>
```

Give each stub a different `tilt` in the -2..2 range — a row of level post-its reads as stamped, not pinned.
