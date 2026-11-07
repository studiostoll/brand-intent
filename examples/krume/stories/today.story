# today.story
# One page, posted every morning the shop is open: today's bread and today's facts.
# The weekday, the sunrise and the closing time come from the calendar, the sky and the
# place; the bread is open and filled from an example, by the baker, or by AI.
# What is not known is not guessed: on a closed day {closes} has no value and the post doesn't go out.

id:     today
name:   Heute
format: 4:5
place:  weserstrasse
topic:  Today's bread, with today's light and today's hours

page
  purpose:     daily-bread
  composition: editorial
  label:       {weekday}
  meta:        Hell seit {sunrise}, Ofen an seit vier. Offen bis {closes}, was weg ist, ist weg.

# ── Examples ──
# The open slots of the page: the bread of the day.

example
  topic: The classic rye loaf on an ordinary weekday
  page 1
    primary:   Roggenlaib
    secondary: 750 g · 5,80 €

example
  topic: The Saturday wheat blend
  page 1
    primary:   Weizenmisch
    secondary: 500 g · 4,20 €
