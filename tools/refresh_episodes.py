"""Daily refresh of Up Next's episode guide from TVmaze (run by .github/workflows/refresh.yml).

For every show still airing (meta status "Returning"), it re-pulls the newest season in the data plus any newer
season TVmaze now lists, and that show's details (network, years, status, runtime). Older seasons, other shows and
anything typed by hand stay as they are. Same rules as the weekly refresh that keeps Home Base's copy (refresh/merge.py).

  python3 tools/refresh_episodes.py            # updates episodes.json and synopses.json in place when something changed
Exit status: 0 = done (changed or not), 1 = a season came back with gaps (nothing written).
"""
import html, json, os, re, sys, time, urllib.request

API = "https://api.tvmaze.com"
GENERIC = re.compile(r"^(episode\s*\d+|tba|tbd|special\s*\d+)?$", re.I)
NO_SUMMARIES = {"game-of-thrones"}
_last = [0.0]


def fetch_json(path):
    """TVmaze allows at least 20 calls every 10 seconds; stay under it and retry a 429."""
    for attempt in range(5):
        wait = 0.6 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        req = urllib.request.Request(API + path, headers={"User-Agent": "up-next-refresh (github.com/josephprestley/up-next)"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(3 + attempt * 3); continue
            if e.code == 404:
                return None
            raise
    raise RuntimeError("TVmaze kept saying slow down: " + path)


def clean(t):
    t = html.unescape(t or "")
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", t).strip()


def year(d):
    return int(d[:4]) if d and re.match(r"^\d{4}", d) else None


def refresh(eps_doc, syn_doc, get=fetch_json):
    """Returns (report lines, problems). Changes eps_doc and syn_doc in place."""
    report, problems = [], []
    for sid, m in list(eps_doc.get("meta", {}).items()):
        if m.get("status") != "Returning" or not m.get("tvmaze"):
            continue
        tid = m["tvmaze"]
        show = get(f"/shows/{tid}")
        seasons = get(f"/shows/{tid}/seasons") or []
        if not show:
            report.append(f"{sid}: TVmaze has no show {tid}, skipped"); continue
        old = eps_doc["shows"].get(sid, [])
        latest = max([r[0] for r in old if r[0] > 0] or [1])
        pull = [s for s in seasons if (s.get("number") or 0) >= latest]
        rows = []
        for s in pull:
            for e in get(f"/seasons/{s['id']}/episodes?specials=1") or []:
                rows.append(dict(season=e.get("season") or s["number"], num=e.get("number"),
                                 date=e.get("airdate") if re.match(r"^\d{4}-\d{2}-\d{2}$", e.get("airdate") or "") else "",
                                 rt=e.get("runtime"), title="" if GENERIC.match(clean(e.get("name"))) else clean(e.get("name")),
                                 summary="" if sid in NO_SUMMARIES else clean(e.get("summary"))[:600]))
        net = (show.get("network") or {}).get("name") or (show.get("webChannel") or {}).get("name") or m.get("network")
        new_meta = dict(m, network=net, start=year(show.get("premiered")) or m.get("start"), end=year(show.get("ended")),
                        status="Ended" if show.get("status") == "Ended" else "Returning",
                        runtime=show.get("averageRuntime") or show.get("runtime") or m.get("runtime"), tvmaze=tid)
        if new_meta["status"] == "Returning":
            new_meta["end"] = None
        if new_meta != m:
            if new_meta["status"] != m.get("status"):
                report.append(f"{sid}: now {new_meta['status']}")
            eps_doc["meta"][sid] = new_meta
        if not rows:
            continue
        # the merge, as in refresh/merge.py: pulled seasons replace those seasons; new specials are appended
        oldsyn = syn_doc.get(sid, {})
        old_titles = {(r[0], r[1]): r[4] for r in old}
        in_pull = {r["season"] for r in rows if r["num"] is not None}
        kept = [r for r in old if r[0] == 0 or r[0] not in in_pull]
        newsyn = {k: v for k, v in oldsyn.items() if int(k.split("-")[0]) == 0 or int(k.split("-")[0]) not in in_pull}
        added = 0
        for r in rows:
            if r["num"] is None:
                continue
            s, n = r["season"], r["num"]
            kept.append([s, n, r["date"], r["rt"], r["title"] or old_titles.get((s, n), "")])
            if r["summary"]:
                newsyn[f"{s}-{n}"] = r["summary"]
            if (s, n) not in old_titles:
                added += 1
        specials = [r for r in kept if r[0] == 0]
        have = {(r[4], r[2]) for r in specials}
        for r in rows:
            if r["num"] is None and r["title"] and (r["title"], r["date"]) not in have:
                n = len(specials) + 1
                row = [0, n, r["date"], r["rt"], r["title"]]
                kept.append(row); specials.append(row); have.add((r["title"], r["date"]))
                if r["summary"]:
                    newsyn[f"0-{n}"] = r["summary"]
                added += 1
        kept.sort(key=lambda r: (r[0] == 0, r[0], r[1]))
        per = {}
        for r in kept:
            if r[0] > 0:
                per.setdefault(r[0], []).append(r[1])
        bad = [s for s, nums in per.items() if sorted(nums) != list(range(1, len(nums) + 1))]
        if bad:
            problems.append(f"{sid} season {bad} numbering"); continue
        if kept != old:
            eps_doc["shows"][sid] = kept
            report.append(f"{sid}: seasons {sorted(in_pull)}, {added} new episode(s)" if added else f"{sid}: details updated")
        if newsyn != oldsyn and newsyn:
            syn_doc[sid] = newsyn
    return report, problems


def main(folder="."):
    ep_path, syn_path = os.path.join(folder, "episodes.json"), os.path.join(folder, "synopses.json")
    eps_doc = json.load(open(ep_path, encoding="utf8"))
    syn_doc = json.load(open(syn_path, encoding="utf8"))
    before = json.dumps([eps_doc.get("meta"), eps_doc.get("shows"), syn_doc], sort_keys=True)
    report, problems = refresh(eps_doc, syn_doc)
    print("\n".join(report) or "No changes.")
    if problems:
        print("PROBLEMS:", problems); return 1
    if json.dumps([eps_doc.get("meta"), eps_doc.get("shows"), syn_doc], sort_keys=True) == before:
        return 0
    eps_doc["updated"] = os.environ.get("TODAY") or time.strftime("%Y-%m-%d")
    json.dump(eps_doc, open(ep_path, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    json.dump(syn_doc, open(syn_path, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "."))
