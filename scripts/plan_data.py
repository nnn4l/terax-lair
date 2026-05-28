#!/usr/bin/env python3
import json
import os
from datetime import datetime
from urllib.error import URLError
from urllib.request import urlopen


DEFAULT_LOCATION = "Local"
DEFAULT_CONDITION = "Weather unavailable"


def read_weather(location: str) -> dict[str, str]:
    query = location if location != DEFAULT_LOCATION else ""
    url = f"https://wttr.in/{query}?format=j1"
    try:
        with urlopen(url, timeout=2.5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, URLError, json.JSONDecodeError):
        return {
            "temp": "--",
            "condition": DEFAULT_CONDITION,
            "location": location,
        }

    current = (payload.get("current_condition") or [{}])[0]
    area = (payload.get("nearest_area") or [{}])[0]
    area_name = (area.get("areaName") or [{}])[0].get("value")
    region = (area.get("region") or [{}])[0].get("value")
    country = (area.get("country") or [{}])[0].get("value")
    condition = (current.get("weatherDesc") or [{}])[0].get("value")
    temp = current.get("temp_F") or current.get("temp_C") or "--"
    place = ", ".join(part for part in (area_name, region or country) if part)

    return {
        "temp": f"{temp}°F" if temp != "--" else temp,
        "condition": condition or DEFAULT_CONDITION,
        "location": place or location,
    }


def main() -> None:
    now = datetime.now().astimezone()
    location = os.environ.get("LAIR_WEATHER_LOCATION", DEFAULT_LOCATION).strip()
    if not location:
        location = DEFAULT_LOCATION

    print(
        json.dumps(
            {
                "day_name": now.strftime("%A"),
                "full_date": now.strftime("%B %-d, %Y")
                if os.name != "nt"
                else now.strftime("%B %#d, %Y"),
                "time_24h": now.strftime("%H:%M"),
                "weather": read_weather(location),
            }
        )
    )


if __name__ == "__main__":
    main()
