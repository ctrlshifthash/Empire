#!/usr/bin/env python3
"""
Seed the three allowlisted wallet accounts with varied top-tier Imperial empires.
Remove existing entries for these wallets first, then re-add with realistic variation.
Run while the server is stopped.
"""
import json, uuid, time, shutil, os

STATE_PATH = os.path.join(os.path.dirname(__file__), "../server/data/state.json")
BACKUP_PATH = STATE_PATH + ".bak"

# wallet → (display_name, personality)
WALLETS = {
    "EZppbZe5RaXryEd47NdPRX1ytjCd7bpqnZMDQQXMBB2s": ("Vaulthorn",  "raider"),
    "57DXn1ZGgfPiT6HqENyokgT9qTyUvpzy4sFraMhAi16z": ("Solgrave",   "balanced"),
    "H61rKATwp2W8AJpZQLarzXyt8Rpho3UzyRhRpkMgAhY":  ("Ashveil",    "builder"),
}

QUESTS = [
    ("q_first_lumber", 1),
    ("q_first_farm",   1),
    ("q_houses",       3),
    ("q_feudal",       1),
    ("q_army_10",     10),
    ("q_first_raid",   1),
    ("q_wood_2000", 2000),
    ("q_castle",       1),
    ("q_army_40",     40),
    ("q_imperial",     1),
    ("q_lumber_2",     2),
    ("q_farms_2",      2),
    ("q_market",       1),
    ("q_barracks",     1),
    ("q_walls_3",      3),
    ("q_tower",        1),
    ("q_raids_3",      3),
    ("q_raids_10",    10),
    ("q_army_25",     25),
    ("q_gold_3000", 3000),
    ("q_stone_3000",3000),
    ("q_stable",       1),
    ("q_houses_5",     5),
    ("q_walls_8",      8),
    ("q_keep",         1),
    ("q_temple",       1),
    ("q_raids_20",    20),
    ("q_army_60",     60),
    ("q_wood_5000", 5000),
    ("q_wonder",       1),
]

def uid(prefix=""):
    return prefix + uuid.uuid4().hex[:16]

def bld(btype, level, x, y):
    return {
        "id": uid("bld_"),
        "type": btype,
        "level": level,
        "x": x,
        "y": y,
        "wx": 24 + (x - 4),
        "wy": 24 + (y - 3),
        "completesAt": None,
        "job": None,
    }

def compute_power(buildings, army, armoury):
    p = 10 + 3 * 150  # imperial
    for b in buildings:
        if b["level"] >= 1:
            p += b["level"] * 8
    unit_power = {"villager": 7, "spearman": 26, "archer": 27, "knight": 60}
    for u, cnt in army.items():
        p += cnt * unit_power.get(u, 0)
    if armoury:
        h = armoury.get("helmet", 0)
        ha = armoury.get("heroArmour", 0)
        p += (h + ha) * 4
        for u in ["villager", "spearman", "archer", "knight"]:
            p += (armoury["weapon"].get(u, 0) + armoury["armour"].get(u, 0)) * 8
    return round(p)

def quests_for(personality):
    # raider: 30/30 claimed
    # balanced: 25/30 claimed (last 5 still in progress)
    # builder: 28/30 claimed (last 2 still in progress)
    CLAIMED = {"raider": 30, "balanced": 25, "builder": 28}
    claimed_limit = CLAIMED[personality]
    out = []
    for i, (qid, goal) in enumerate(QUESTS):
        if i < claimed_limit:
            out.append({"questId": qid, "progress": goal, "goal": goal, "completed": True, "claimed": True})
        else:
            out.append({"questId": qid, "progress": goal // 2, "goal": goal, "completed": False, "claimed": False})
    return out

# ── per-personality profiles ────────────────────────────────────────────────

PROFILES = {
    # Heavy knight raider — big army, fewer buildings finished, aggressive stats
    "raider": {
        "banner": "#6a0000",
        "tile": (15, 8),
        "createdAt_delta_days": -2,  # joined 2 days ago
        "army": {"villager": 4, "spearman": 60, "archer": 45, "knight": 140},
        "armoury": {
            "weapon":    {"villager": 3, "spearman": 5, "archer": 4, "knight": 5},
            "armour":    {"villager": 3, "spearman": 4, "archer": 4, "knight": 5},
            "helmet": 5, "heroArmour": 4,
        },
        "resources": {"wood": 12000, "food": 38000, "gold": 25000, "stone": 8000},
        "coins": 4200,
        "raidsWon": 47, "raidsLost": 9,
        "duelsWon": 22, "duelsLost": 7, "duelStreak": 5,
        "bossKills": 9,
        "buildings": [
            bld("town_center",    5, 4, 3),
            bld("house",          5, 0, 0),
            bld("house",          5, 1, 0),
            bld("house",          5, 2, 0),
            bld("house",          4, 3, 0),
            bld("house",          4, 4, 0),
            bld("lumber_camp",    4, 5, 0),
            bld("lumber_camp",    4, 6, 0),
            bld("farm",           4, 7, 0),
            bld("farm",           5, 8, 0),
            bld("gold_mine",      4, 0, 1),
            bld("quarry",         3, 1, 1),
            bld("barracks",       5, 3, 1),
            bld("archery_range",  5, 5, 1),
            bld("stable",         5, 6, 1),
            bld("keep",           5, 7, 1),
            bld("tower",          4, 8, 1),
            bld("wall",           3, 0, 2),
            bld("wall",           3, 1, 2),
            bld("wall",           3, 2, 2),
            bld("wall",           3, 3, 2),
            bld("wall",           3, 5, 2),
            bld("wall",           3, 6, 2),
            bld("wall",           3, 7, 2),
            bld("wall",           3, 8, 2),
            bld("temple",         2, 0, 4),
            bld("wonder",         1, 8, 4),
        ],
    },

    # Balanced — well-rounded stats, steady grind
    "balanced": {
        "banner": "#1a237e",
        "tile": (22, 12),
        "createdAt_delta_days": -1,
        "army": {"villager": 6, "spearman": 110, "archer": 85, "knight": 95},
        "armoury": {
            "weapon":    {"villager": 4, "spearman": 5, "archer": 5, "knight": 5},
            "armour":    {"villager": 3, "spearman": 5, "archer": 4, "knight": 5},
            "helmet": 4, "heroArmour": 4,
        },
        "resources": {"wood": 28000, "food": 31000, "gold": 19000, "stone": 22000},
        "coins": 8800,
        "raidsWon": 29, "raidsLost": 6,
        "duelsWon": 14, "duelsLost": 5, "duelStreak": 2,
        "bossKills": 5,
        "buildings": [
            bld("town_center",    5, 4, 3),
            bld("house",          5, 0, 0),
            bld("house",          5, 1, 0),
            bld("house",          5, 2, 0),
            bld("house",          5, 3, 0),
            bld("house",          5, 4, 0),
            bld("lumber_camp",    5, 5, 0),
            bld("lumber_camp",    5, 6, 0),
            bld("farm",           5, 7, 0),
            bld("farm",           5, 8, 0),
            bld("gold_mine",      5, 0, 1),
            bld("quarry",         4, 1, 1),
            bld("market",         4, 2, 1),
            bld("barracks",       5, 3, 1),
            bld("archery_range",  5, 5, 1),
            bld("stable",         5, 6, 1),
            bld("keep",           5, 7, 1),
            bld("tower",          3, 8, 1),
            bld("wall",           3, 0, 2),
            bld("wall",           3, 1, 2),
            bld("wall",           3, 2, 2),
            bld("wall",           3, 3, 2),
            bld("wall",           3, 5, 2),
            bld("wall",           3, 6, 2),
            bld("wall",           3, 7, 2),
            bld("wall",           3, 8, 2),
            bld("temple",         3, 0, 4),
            bld("wonder",         1, 8, 4),
        ],
    },

    # Builder/economic — most buildings maxed, smaller army, deep resources
    "builder": {
        "banner": "#1b5e20",
        "tile": (29, 8),
        "createdAt_delta_days": -2,
        "army": {"villager": 8, "spearman": 75, "archer": 65, "knight": 70},
        "armoury": {
            "weapon":    {"villager": 3, "spearman": 4, "archer": 5, "knight": 4},
            "armour":    {"villager": 3, "spearman": 4, "archer": 4, "knight": 4},
            "helmet": 4, "heroArmour": 3,
        },
        "resources": {"wood": 65000, "food": 48000, "gold": 52000, "stone": 71000},
        "coins": 15500,
        "raidsWon": 17, "raidsLost": 4,
        "duelsWon": 8, "duelsLost": 4, "duelStreak": 1,
        "bossKills": 3,
        "buildings": [
            bld("town_center",    5, 4, 3),
            bld("house",          5, 0, 0),
            bld("house",          5, 1, 0),
            bld("house",          5, 2, 0),
            bld("house",          5, 3, 0),
            bld("house",          5, 4, 0),
            bld("lumber_camp",    5, 5, 0),
            bld("lumber_camp",    5, 6, 0),
            bld("farm",           5, 7, 0),
            bld("farm",           5, 8, 0),
            bld("gold_mine",      5, 0, 1),
            bld("quarry",         5, 1, 1),
            bld("market",         5, 2, 1),
            bld("barracks",       4, 3, 1),
            bld("archery_range",  4, 5, 1),
            bld("stable",         4, 6, 1),
            bld("keep",           5, 7, 1),
            bld("tower",          3, 8, 1),
            bld("wall",           4, 0, 2),
            bld("wall",           4, 1, 2),
            bld("wall",           4, 2, 2),
            bld("wall",           4, 3, 2),
            bld("wall",           4, 5, 2),
            bld("wall",           4, 6, 2),
            bld("wall",           4, 7, 2),
            bld("wall",           4, 8, 2),
            bld("temple",         4, 0, 4),
            bld("wonder",         1, 8, 4),
        ],
    },
}

def hero_for(personality):
    if personality == "raider":
        return {
            "skills": {"woodcutting": 80000, "mining": 65000, "foraging": 55000, "combat": 280000, "construction": 70000},
            "tools":  {"axe": 4, "pickaxe": 4, "sickle": 3, "sword": 5},
        }
    if personality == "balanced":
        return {
            "skills": {"woodcutting": 130000, "mining": 110000, "foraging": 95000, "combat": 160000, "construction": 120000},
            "tools":  {"axe": 5, "pickaxe": 4, "sickle": 4, "sword": 5},
        }
    # builder
    return {
        "skills": {"woodcutting": 190000, "mining": 175000, "foraging": 140000, "combat": 90000, "construction": 210000},
        "tools":  {"axe": 5, "pickaxe": 5, "sickle": 5, "sword": 3},
    }

def make_empire(wallet, name, personality, user_id):
    p = PROFILES[personality]
    now_ms = int(time.time() * 1000)
    created_ms = now_ms + p["createdAt_delta_days"] * 86400 * 1000
    buildings = p["buildings"]
    army = p["army"]
    armoury = p["armoury"]
    power = compute_power(buildings, army, armoury)
    return {
        "id": uid("emp_"),
        "userId": user_id,
        "name": name,
        "banner": p["banner"],
        "isBot": False,
        "age": "imperial",
        "tileX": p["tile"][0],
        "tileY": p["tile"][1],
        "resources": p["resources"],
        "lastTick": now_ms,
        "buildings": buildings,
        "army": army,
        "trainQueue": [],
        "ageUpCompletesAt": None,
        "coins": p["coins"],
        "hero": hero_for(personality),
        "quests": quests_for(personality),
        "battles": [],
        "log": [{
            "id": uid("log_"),
            "at": created_ms,
            "kind": "system",
            "text": "Your empire is founded. Long may it reign!",
        }],
        "power": power,
        "raidsWon":  p["raidsWon"],
        "raidsLost": p["raidsLost"],
        "createdAt": created_ms,
        "armoury": armoury,
        "duelsWon":   p["duelsWon"],
        "duelsLost":  p["duelsLost"],
        "duelStreak": p["duelStreak"],
        "bossKills":  p["bossKills"],
    }

def main():
    with open(STATE_PATH) as f:
        state = json.load(f)

    shutil.copy2(STATE_PATH, BACKUP_PATH)
    print(f"Backed up state to {BACKUP_PATH}")

    # Remove any existing users/empires tied to these wallets
    for wallet in WALLETS:
        existing_user = next(
            (u for u in state["users"].values() if u.get("externalId") == wallet),
            None
        )
        if existing_user:
            eid = existing_user.get("empireId")
            uid_key = existing_user["id"]
            state["users"].pop(uid_key, None)
            state["empires"].pop(eid, None)
            print(f"Removed existing account for {wallet[:8]}…")

    for wallet, (name, personality) in WALLETS.items():
        user_id = uid("usr_")
        empire = make_empire(wallet, name, personality, user_id)
        state["empires"][empire["id"]] = empire
        state["users"][user_id] = {
            "id": user_id,
            "username": name,
            "passHash": "",
            "empireId": empire["id"],
            "createdAt": empire["createdAt"],
            "externalId": wallet,
        }
        print(f"  {name:12s} ({personality:8s}) power={empire['power']:5d}  raids={empire['raidsWon']}W/{empire['raidsLost']}L  tile={empire['tileX']},{empire['tileY']}")

    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE_PATH)
    print("Done — state.json updated.")

if __name__ == "__main__":
    main()
