# breads-of-the-week.story
# Three breads of the week, one page each, posted as a carousel.
# The label on the first page is fixed and carries the date; everything else is open.

id:     breads-of-the-week
name:   Breads of the Week
format: 4:5
topic:  The three breads baked every day this week

page
  purpose:     daily-bread
  composition: editorial
  label:       From {date}

page
  purpose: daily-bread

page
  purpose: daily-bread

# ── Examples ──
# One whole story per example: the open slots of all pages, about one story topic.

example
  topic: A rye week: three rye breads from mild to dark
  page 1
    topic:     Light rye, the mild start
    primary:   Light rye
    secondary: 750 g · €5.40
    meta:      Rye 997 with a little wheat, 14 hours of fermentation.
  page 2
    topic:     The classic rye loaf
    label:     The classic
    primary:   Rye loaf
    secondary: 750 g · €5.80
    meta:      Rye 1150, 18 hours of fermentation, caraway from the Wendland.
  page 3
    topic:     Dark whole-grain rye, the strongest
    label:     Hearty
    primary:   Whole-grain rye
    secondary: 1 kg · €7.20
    meta:      Whole grain, two days of sourdough, keeps a week.
