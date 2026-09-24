#!/usr/bin/python3
"""Drive a real WebKit (WebKitGTK) page headlessly - the engine Safari is built on.

Needs the system WebKitGTK bindings and a virtual display:
    sudo apt-get install gir1.2-webkit2-4.1 python3-gi python3-gi-cairo xvfb
and must run under the python those bindings were built for, which is not
always the one called python3 (tools/cross-engine.js finds it for you):
    xvfb-run -a /usr/bin/python3.12 tools/webkit/wk.py 1280x860 SOME.js [shot.png]

Set BLOCK_STORAGE=1 to make localStorage throw on access, which is what
Safari does with "Block All Cookies" and in Lockdown Mode.

  wk.py WIDTHxHEIGHT JSFILE [SHOT.png] [--clear] [--reload-between]

JSFILE is the BODY of an async function. It runs after the page has loaded;
whatever it returns (JSON-serialisable) is printed as the result. Errors that
reach window.onerror / unhandledrejection, and console.error/warn, are
collected by a user script injected at document start and printed too.
"""
import sys, json, gi
gi.require_version('Gtk', '3.0')
gi.require_version('WebKit2', '4.1')
from gi.repository import Gtk, WebKit2, GLib

size, jsfile = sys.argv[1], sys.argv[2]
shot = sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else None
w, h = [int(x) for x in size.split('x')]
body = open(jsfile).read()
import os
URL = 'file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'index.html'))

PRELUDE = r"""
window.__wkErrors = [];
window.addEventListener('error', function (e) {
  window.__wkErrors.push('ERROR ' + (e.message || e) + ' @' + (e.filename || '').split('/').pop() + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function (e) {
  window.__wkErrors.push('REJECT ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason));
});
['error', 'warn'].forEach(function (k) {
  var o = console[k];
  console[k] = function () {
    window.__wkErrors.push(k.toUpperCase() + ' ' + [].slice.call(arguments).join(' '));
    return o.apply(console, arguments);
  };
});
"""

import os
BLOCK = r'''
// What Safari does with "Block All Cookies" (and Lockdown Mode, and some
// private configurations): touching localStorage at all throws.
Object.defineProperty(window, 'localStorage', { configurable: true, get: function () {
  throw new DOMException('The operation is insecure.', 'SecurityError'); } });
'''
if os.environ.get('BLOCK_STORAGE'):
    PRELUDE = BLOCK + PRELUDE
ucm = WebKit2.UserContentManager()
ucm.add_script(WebKit2.UserScript.new(
    PRELUDE, WebKit2.UserContentInjectedFrames.ALL_FRAMES,
    WebKit2.UserScriptInjectionTime.START, None, None))
view = WebKit2.WebView.new_with_user_content_manager(ucm)
s = view.get_settings()
s.set_allow_file_access_from_file_urls(True)
s.set_allow_universal_access_from_file_urls(True)
s.set_enable_developer_extras(True)
s.set_enable_write_console_messages_to_stdout(False)
s.set_hardware_acceleration_policy(WebKit2.HardwareAccelerationPolicy.NEVER)

win = Gtk.OffscreenWindow()
win.set_default_size(w, h)
view.set_size_request(w, h)
win.add(view)
win.show_all()

state = {'done': False}

def finish(code=0):
    Gtk.main_quit()
    sys.exit(code)

def after_snapshot(v, res):
    try:
        surf = v.get_snapshot_finish(res)
        surf.write_to_png(shot)
    except Exception as e:
        print('SNAPSHOT-FAILED', e)
    finish()

def after_run(v, res):
    try:
        val = v.call_async_javascript_function_finish(res)
        out = val.to_json(0) if val is not None else 'null'
        print('RESULT', out)
    except Exception as e:
        print('JS-EXCEPTION', e)
    # collect errors last
    v.evaluate_javascript('JSON.stringify(window.__wkErrors || [])', -1, None, None, None,
                          after_errors)

def after_errors(v, res):
    try:
        errs = json.loads(v.evaluate_javascript_finish(res).to_string())
    except Exception as e:
        errs = ['(could not read errors: %s)' % e]
    print('ERRORS', json.dumps(errs))
    if shot:
        GLib.timeout_add(250, lambda: (v.get_snapshot(WebKit2.SnapshotRegion.VISIBLE,
                                                      WebKit2.SnapshotOptions.NONE, None,
                                                      after_snapshot), False)[1])
    else:
        finish()

def run():
    view.call_async_javascript_function(body, -1, None, None, None, None, after_run)
    return False

def on_load(v, ev):
    if ev == WebKit2.LoadEvent.FINISHED and not state['done']:
        state['done'] = True
        GLib.timeout_add(600, run)

view.connect('load-changed', on_load)
GLib.timeout_add(240000, lambda: (print('TIMEOUT'), finish(2)))
view.load_uri(URL)
Gtk.main()
