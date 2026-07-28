#!/usr/bin/env python3
"""Convert WordPress WXR export XML to CSV with full post content and metadata."""

import argparse
import csv
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

NAMESPACES = {
    "content": "http://purl.org/rss/1.0/modules/content/",
    "wp": "http://wordpress.org/export/1.2/",
    "dc": "http://purl.org/dc/elements/1.1/",
    "excerpt": "http://wordpress.org/export/1.2/excerpt/",
}

WP_FIELDS = [
    "post_id",
    "post_date",
    "post_date_gmt",
    "post_modified",
    "post_modified_gmt",
    "comment_status",
    "ping_status",
    "post_name",
    "status",
    "post_parent",
    "menu_order",
    "post_type",
    "post_password",
    "is_sticky",
]

RSS_FIELDS = [
    "title",
    "link",
    "pubDate",
    "creator",
    "guid",
    "description",
    "content_encoded",
    "excerpt_encoded",
]


def text_or_empty(element):
    if element is None:
        return ""
    return (element.text or "").strip()


def parse_categories(item):
    categories = []
    for cat in item.findall("category"):
        categories.append(
            {
                "domain": cat.get("domain", ""),
                "nicename": cat.get("nicename", ""),
                "name": text_or_empty(cat),
            }
        )
    return categories


def parse_postmeta(item, ns):
    meta = {}
    for pm in item.findall("wp:postmeta", ns):
        key = text_or_empty(pm.find("wp:meta_key", ns))
        value = text_or_empty(pm.find("wp:meta_value", ns))
        if not key:
            continue
        if key in meta:
            existing = meta[key]
            if isinstance(existing, list):
                existing.append(value)
            else:
                meta[key] = [existing, value]
        else:
            meta[key] = value
    return meta


def parse_item(item, ns):
    guid_el = item.find("guid")
    row = {
        "title": text_or_empty(item.find("title")),
        "link": text_or_empty(item.find("link")),
        "pubDate": text_or_empty(item.find("pubDate")),
        "creator": text_or_empty(item.find("dc:creator", ns)),
        "guid": text_or_empty(guid_el),
        "guid_is_permalink": guid_el.get("isPermaLink", "") if guid_el is not None else "",
        "description": text_or_empty(item.find("description")),
        "content_encoded": text_or_empty(item.find("content:encoded", ns)),
        "excerpt_encoded": text_or_empty(item.find("excerpt:encoded", ns)),
    }
    for field in WP_FIELDS:
        row[field] = text_or_empty(item.find(f"wp:{field}", ns))
    row["categories_json"] = json.dumps(parse_categories(item), ensure_ascii=False)
    row["postmeta_json"] = json.dumps(parse_postmeta(item, ns), ensure_ascii=False)
    return row


def parse_authors(channel, ns):
    authors = []
    for author in channel.findall("wp:author", ns):
        authors.append(
            {
                "author_id": text_or_empty(author.find("wp:author_id", ns)),
                "author_login": text_or_empty(author.find("wp:author_login", ns)),
                "author_email": text_or_empty(author.find("wp:author_email", ns)),
                "author_display_name": text_or_empty(author.find("wp:author_display_name", ns)),
                "author_first_name": text_or_empty(author.find("wp:author_first_name", ns)),
                "author_last_name": text_or_empty(author.find("wp:author_last_name", ns)),
            }
        )
    return authors


def parse_channel_meta(channel, ns):
    return {
        "site_title": text_or_empty(channel.find("title")),
        "site_link": text_or_empty(channel.find("link")),
        "site_description": text_or_empty(channel.find("description")),
        "pubDate": text_or_empty(channel.find("pubDate")),
        "language": text_or_empty(channel.find("language")),
        "wxr_version": text_or_empty(channel.find("wp:wxr_version", ns)),
        "base_site_url": text_or_empty(channel.find("wp:base_site_url", ns)),
        "base_blog_url": text_or_empty(channel.find("wp:base_blog_url", ns)),
    }


def write_csv(path, rows, fieldnames):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)


def convert(xml_path, output_dir=None):
    xml_path = Path(xml_path)
    if output_dir is None:
        output_dir = xml_path.parent
    else:
        output_dir = Path(output_dir)

    stem = xml_path.stem
    posts_csv = output_dir / f"{stem}-posts.csv"
    authors_csv = output_dir / f"{stem}-authors.csv"
    site_csv = output_dir / f"{stem}-site.csv"

    tree = ET.parse(xml_path)
    root = tree.getroot()
    channel = root.find("channel")
    if channel is None:
        raise ValueError("No <channel> element found in WordPress export.")

    ns = NAMESPACES
    items = channel.findall("item")
    rows = [parse_item(item, ns) for item in items]

    fieldnames = RSS_FIELDS + ["guid_is_permalink"] + WP_FIELDS + ["categories_json", "postmeta_json"]
    write_csv(posts_csv, rows, fieldnames)

    authors = parse_authors(channel, ns)
    if authors:
        author_fields = list(authors[0].keys())
        write_csv(authors_csv, authors, author_fields)

    site_meta = parse_channel_meta(channel, ns)
    write_csv(site_csv, [site_meta], list(site_meta.keys()))

    return {
        "posts_csv": str(posts_csv),
        "authors_csv": str(authors_csv) if authors else None,
        "site_csv": str(site_csv),
        "item_count": len(rows),
        "post_types": {},
    }


def main():
    parser = argparse.ArgumentParser(description="Convert WordPress WXR XML to CSV.")
    parser.add_argument("xml_path", help="Path to WordPress export .xml file")
    parser.add_argument("-o", "--output-dir", help="Output directory (default: same as XML)")
    args = parser.parse_args()

    result = convert(args.xml_path, args.output_dir)
    print(f"Converted {result['item_count']} items -> {result['posts_csv']}")
    if result["authors_csv"]:
        print(f"Authors -> {result['authors_csv']}")
    print(f"Site metadata -> {result['site_csv']}")


if __name__ == "__main__":
    main()
