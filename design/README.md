# Cine Compass programme

Active visual reference: `schedule-concept-warm.png`. The original cold concept was rejected by the user and is superseded.

Warm paper #f5f0e6, chocolate ink #29231f, burgundy #6e282d, tan rules #c9bba9. Georgia editorial typography with strong titles and start times. Open 248px filter rail, thin dividers, no cards, gradients, or dashboard containers. Two mutually exclusive views: Posters with artwork and synopsis; Compact as a dense aligned table with no images. Mobile compact rows reflow to keep all information visible.

Intentional adaptations: live API content/counts replace illustrative examples; compact is switchable, never shown beneath Posters; missing street addresses omitted; existing double-bill planner kept behind start-time selection. Native date/time controls preserve keyboard usability. An extra header link opens all unchanged original views at #classic. Films without poster artwork are included in the new UI. Filter choices come from city/date source data and remain available after filtering. Daily time windows apply to every day in a date range. Defaults and Reset use today in Amsterdam, from the current time to 23:59; stale saved dates advance to today.

Visual verification: Codex in-app browser at 1440x1000 and 390x844. Compared warm concept and rendered screenshots through view_image. Checked paper/burgundy colors, serif hierarchy, open filter rail, ruled row structure, poster aspect/crop, time and venue alignment, and phone reflow. Replaced the initial cold concept; removed generic cards and consolidated extra modes. Visible copy follows the warm concept with functional additions listed above. Data and counts intentionally vary with the live programme.

Final validation: production build successful; 8 focused tests pass. Browser checks covered search, English subtitles, time inputs, save/remove, native film-details dialog, double-bill availability, and Classic/new navigation. Desktop captures are retained as the review artifacts.
