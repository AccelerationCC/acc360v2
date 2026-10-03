# Observance images

Drop curated images here, then run `npx tsx scripts/upload-observance-images.ts`.

**Nothing in this directory is committed.** `.gitignore` excludes the images
themselves and keeps this README. The blob store is the artefact; the local files
are the input to one upload.

## Filename convention

```
<observance id>.<ext>        e.g.  mlk-day.jpg
                                   world-aids-day.png
```

The **id**, not the display name. Three reasons, each checkable:

- Ids are already guaranteed unique — `lib/observances.ts` throws at module load
  on a duplicate, so two files cannot silently target one row.
- Ids are already constrained to `^[a-z0-9-]+$` by the schema, so a filename
  built from one needs no escaping and survives a URL path unchanged.
- Display names contain apostrophes and capitals (`Women's History Month`), which
  are exactly the characters that make filename matching fragile.

The full list of ids is printed by the script when a filename matches no row.

## Dimensions: 1280 × 720

**Not a taste call — both numbers come from the template.**

`components/newsletter/NewsletterTemplate.tsx` renders each observance image as
`<img width={640} height={360} />` inside `.wrap { max-width: 640px }`. So:

- **640px** is the layout width the image is displayed at.
- **1280px** is 2× that, which is what a retina display samples. Supplying 640
  would look soft on every modern laptop and phone.
- **720** follows from **16:9**, because the template's declared `640×360` is
  16:9. An image of another ratio will be stretched or letterboxed — the template
  does not crop, and its dimensions are hardcoded on purpose (the whole point of
  a locked template is that a sender cannot restyle a slot).

If the template's declared size ever changes, change this number with it. They
are two copies of one fact, which is the drift `issues/029` catalogues; the test
in `lib/observanceImages.test.ts` is what keeps them honest.

## Formats: JPEG or PNG only

- **JPEG** for photographs.
- **PNG** for flat-colour graphics, logos, or anything needing transparency.

**WebP and AVIF are excluded deliberately**, even though the current target is a
web page that would render them fine. The constraint is future, not present: this
newsletter was originally briefed as an email, and the send path was dropped only
because tracing the code showed nothing sends it today. If a sender is ever
added, JPEG and PNG are the only two formats every mail client renders. Choosing
them now costs a little file size and avoids re-curating twenty images later.

## File size: aim under 200 KB each

Twenty images at 200 KB is ~4 MB of blob storage and, more importantly, whatever
subset appears in one edition is downloaded by every reader. An edition shows at
most 4 observances (`observancesForEdition` caps at 4), so the realistic ceiling
is ~800 KB of imagery per view. Above that a brief starts to feel slow on a phone
for no editorial gain.

This is a target, not a gate — the script does not reject a large file. It is the
one value here that is judgement rather than a derived constraint, and it is
flagged as such.

## Alt text is NOT set by the upload script

`imageAlt` stays `null` and must be written by the person who chose the image.
Alt text describes what a human decided to show; it cannot be derived from a
filename, and inventing it produces confident, wrong descriptions of pictures
nobody checked.

The script **fails** if any row ends up with an `imageUrl` and a null `imageAlt`,
so a half-finished state cannot ship.
