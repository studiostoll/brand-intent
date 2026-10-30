# breads-of-the-week.story
# Three breads of the week, one page each, posted as a carousel.
# The label on the first page is fixed and carries the date; everything else is open.

id:     breads-of-the-week
name:   Brote der Woche
format: 4:5
topic:  The three breads baked every day this week

page
  purpose:     daily-bread
  composition: editorial
  label:       Ab {date}

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
    primary:   Hellroggen
    secondary: 750 g · 5,40 €
    meta:      Roggen 997 mit etwas Weizen, 14 Stunden Teigführung.
  page 2
    topic:     The classic rye loaf
    label:     Der Klassiker
    primary:   Roggenlaib
    secondary: 750 g · 5,80 €
    meta:      Roggen 1150, 18 Stunden Teigführung, Kümmel aus dem Wendland.
  page 3
    topic:     Dark whole-grain rye, the strongest
    label:     Kräftig
    primary:   Vollkornroggen
    secondary: 1 kg · 7,20 €
    meta:      Ganzes Korn, zwei Tage Sauerteig, hält eine Woche.
