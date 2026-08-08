/**
 * Decode HTML entities for Flow Assist display strings.
 */
(function (global) {
  'use strict';

  function decode(text) {
    if (text == null || text === '') {
      return '';
    }

    var decoded = String(text);
    var el = document.createElement('textarea');
    var i;
    for (i = 0; i < 3; i++) {
      el.innerHTML = decoded;
      var next = el.value;
      if (next === decoded) {
        break;
      }
      decoded = next;
    }

    return decoded;
  }

  function decodeCard(card) {
    if (!card || typeof card !== 'object') {
      return card;
    }

    var out = Object.assign({}, card);
    if (typeof out.title === 'string') {
      out.title = decode(out.title);
    }
    if (typeof out.body === 'string') {
      out.body = decode(out.body);
    }
    if (out.cta && typeof out.cta === 'object' && typeof out.cta.label === 'string') {
      out.cta = Object.assign({}, out.cta, { label: decode(out.cta.label) });
    }
    if (Array.isArray(out.links)) {
      out.links = out.links.map(function (link) {
        if (!link || typeof link !== 'object' || typeof link.label !== 'string') {
          return link;
        }
        return Object.assign({}, link, { label: decode(link.label) });
      });
    }
    if (Array.isArray(out.relatedTopics)) {
      out.relatedTopics = out.relatedTopics.map(function (topic) {
        return typeof topic === 'string' ? decode(topic) : topic;
      });
    }

    return out;
  }

  global.FlowbieDisplayText = {
    decode: decode,
    decodeCard: decodeCard
  };
})(typeof window !== 'undefined' ? window : this);
