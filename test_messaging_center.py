"""Tests for the standalone admin Messaging Center.

Covers the separation of messaging from invitations and the three destinations
introduced by the Messaging Center:

  • announce — a persistent in-app announcement to every admitted beta
    participant (surfaces in the beta hub Announcements feed).
  • person   — a private in-app message to one admitted participant (surfaces
    only in that participant's own "For you" block).
  • email    — an outbound email to the distinct addresses of admitted
    participants, fail-closed when SMTP is unconfigured, sent individually.

Also verifies auth gating, admitted-only audiences, email dedupe, no recipient
leakage in client responses, participant identity isolation across independent
personal/campaign sessions, and legacy broadcast compatibility.

Run with:  python -m unittest test_messaging_center -v
(stdlib unittest + FastAPI's TestClient — no new dependencies, no live email)
"""

import os
import tempfile
import unittest
from unittest import mock
from urllib.parse import urlparse

os.environ.setdefault("ANTHROPIC_API_KEY", "sk-test-key-should-not-leak")
os.environ.setdefault("ADMIN_ACCESS_CODE", "unit-test-admin-code")
_TMP_DIR = tempfile.mkdtemp(prefix="commonunity_messaging_test_")
os.environ["COMMONUNITY_ADMIN_DB_PATH"] = os.path.join(_TMP_DIR, "admin.sqlite3")
# Ensure SMTP looks unconfigured by default so the fail-closed path is the
# baseline and no live email is ever attempted during tests.
for _k in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"):
    os.environ.pop(_k, None)

from fastapi.testclient import TestClient  # noqa: E402
import server  # noqa: E402

ADMIN_CODE = os.environ["ADMIN_ACCESS_CODE"]


def _admin() -> TestClient:
    c = TestClient(server.app)
    r = c.post("/api/admin/login", json={"code": ADMIN_CODE})
    assert r.status_code == 200, r.text
    return c


def _path_of(url: str) -> str:
    p = urlparse(url)
    return p.path + (("?" + p.query) if p.query else "")


def _create_invite(admin: TestClient, name: str, email: str = "") -> dict:
    r = admin.post("/api/admin/invites", json={"name": name, "email": email})
    assert r.status_code == 200, r.text
    return r.json()


def _create_campaign(admin: TestClient, name: str) -> dict:
    r = admin.post("/api/admin/campaigns", json={"name": name})
    assert r.status_code == 200, r.text
    return r.json()


def _admit_personal(magic_link: str, name: str, email: str) -> TestClient:
    """Admit a personal invitee. Returns a client carrying that participant's
    own signed invite cookie. The magic-link GET only sets the invite cookie
    (its landing page is irrelevant here), so admission is what we assert."""
    c = TestClient(server.app)
    c.get(_path_of(magic_link), follow_redirects=True)
    r = c.post("/api/beta/admit", json={"name": name, "email": email})
    assert r.status_code == 200, r.text
    return c


def _admit_campaign(campaign_link: str, name: str, email: str) -> TestClient:
    """Admit a campaign enrollee. Returns a client carrying that participant's
    own freshly-minted invite cookie."""
    c = TestClient(server.app)
    c.get(_path_of(campaign_link), follow_redirects=True)
    r = c.post("/api/beta/admit", json={"name": name, "email": email})
    assert r.status_code == 200, r.text
    return c


class AuthTests(unittest.TestCase):
    def test_messaging_endpoints_require_admin(self):
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/admin/messaging/recipients").status_code, 401)
        self.assertEqual(anon.get("/api/admin/messaging/participants").status_code, 401)
        self.assertEqual(anon.post("/api/admin/messaging/announce", json={"body": "x"}).status_code, 401)
        self.assertEqual(anon.post("/api/admin/messaging/person", json={"invite_id": 1, "body": "x"}).status_code, 401)
        self.assertEqual(anon.post("/api/admin/messaging/email", json={"body": "x"}).status_code, 401)


class AudienceTests(unittest.TestCase):
    def test_recipients_counts_only_admitted_participants(self):
        admin = _admin()
        # An unadmitted invite (never crosses /beta) must not count.
        _create_invite(admin, "Unadmitted", "unadmitted@example.com")
        # An admitted personal invite counts.
        inv = _create_invite(admin, "Ada", "ada@example.com")
        _admit_personal(inv["magic_link"], "Ada", "ada@example.com")

        r = admin.get("/api/admin/messaging/recipients")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertGreaterEqual(data["total"], 1)
        # The unadmitted invite is excluded: only admitted participants counted.
        parts = admin.get("/api/admin/messaging/participants").json()["participants"]
        names = {p["name"] for p in parts}
        self.assertIn("Ada", names)
        self.assertNotIn("Unadmitted", names)

    def test_email_dedupe_counts_distinct_addresses(self):
        admin = _admin()
        # Two admitted invites sharing one normalized email → one distinct email.
        i1 = _create_invite(admin, "Dup One", "Dup@Example.com")
        _admit_personal(i1["magic_link"], "Dup One", "Dup@Example.com")
        i2 = _create_invite(admin, "Dup Two", "dup@example.com")
        _admit_personal(i2["magic_link"], "Dup Two", "dup@example.com")

        data = admin.get("/api/admin/messaging/recipients").json()
        # Both admitted (with_email >= 2) but distinct_emails collapses them.
        self.assertGreaterEqual(data["with_email"], 2)
        # Exactly-one for the shared address: distinct < with_email here.
        self.assertLess(data["distinct_emails"], data["with_email"])

    def test_campaign_template_is_not_a_participant(self):
        admin = _admin()
        _create_campaign(admin, "WhatsApp group")
        parts = admin.get("/api/admin/messaging/participants").json()["participants"]
        # The campaign template row (kind='campaign') is never a person.
        self.assertTrue(all(p["kind"] != "campaign" for p in parts))


class AnnounceTests(unittest.TestCase):
    def test_announcement_visible_to_all_admitted_not_anonymous(self):
        admin = _admin()
        inv = _create_invite(admin, "Bea", "bea@example.com")
        client = _admit_personal(inv["magic_link"], "Bea", "bea@example.com")

        r = admin.post("/api/admin/messaging/announce",
                       json={"subject": "Hello beta", "body": "The path opens."})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["destination"], "announce")
        self.assertGreaterEqual(r.json()["recipients"], 1)

        # Admitted participant sees it as a broadcast (Announcements feed).
        msgs = client.get("/api/messages").json()["messages"]
        subjects = {m["subject"] for m in msgs}
        self.assertIn("Hello beta", subjects)
        self.assertTrue(any(m["kind"] == "broadcast" for m in msgs))

        # An anonymous visitor (no invite cookie) sees nothing.
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/messages").json()["messages"], [])

    def test_announce_requires_body_and_recipients(self):
        admin = _admin()
        self.assertEqual(
            admin.post("/api/admin/messaging/announce", json={"body": "   "}).status_code, 400
        )


class AnnouncementPersistenceTests(unittest.TestCase):
    """A general beta announcement is a persistent shared feed: visible to every
    admitted participant, including one admitted AFTER it was posted (audience
    membership, not a delivery row created at post time)."""

    def test_late_joiner_sees_announcement_posted_before_admission(self):
        admin = _admin()
        # One participant admitted BEFORE the announcement.
        early_inv = _create_invite(admin, "Early", "early@example.com")
        early = _admit_personal(early_inv["magic_link"], "Early", "early@example.com")

        r = admin.post("/api/admin/messaging/announce",
                       json={"subject": "Shared word", "body": "Held for the whole beta."})
        self.assertEqual(r.status_code, 200, r.text)

        # A DIFFERENT participant admitted AFTER the announcement was posted.
        late_inv = _create_invite(admin, "Late", "late@example.com")
        late = _admit_personal(late_inv["magic_link"], "Late", "late@example.com")

        # Both the early and the late participant see the announcement.
        early_subjects = {m["subject"] for m in early.get("/api/messages").json()["messages"]}
        late_subjects = {m["subject"] for m in late.get("/api/messages").json()["messages"]}
        self.assertIn("Shared word", early_subjects)
        self.assertIn("Shared word", late_subjects)
        # The late joiner sees it as a shared broadcast, not a personal message.
        late_msgs = late.get("/api/messages").json()["messages"]
        self.assertTrue(any(m["subject"] == "Shared word" and m["kind"] == "broadcast" for m in late_msgs))

    def test_announcement_not_visible_to_unauthenticated_or_unadmitted(self):
        admin = _admin()
        seed = _create_invite(admin, "Seed", "seed@example.com")
        _admit_personal(seed["magic_link"], "Seed", "seed@example.com")
        admin.post("/api/admin/messaging/announce",
                   json={"subject": "Members only", "body": "Not for the public."})

        # Unauthenticated: no invite cookie → nothing.
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/messages").json()["messages"], [])

        # Invited but NOT yet admitted (cookie set by opening the link, but the
        # threshold was never crossed) → still no announcements.
        pending_inv = _create_invite(admin, "Pending", "pending@example.com")
        pending = TestClient(server.app)
        pending.get(_path_of(pending_inv["magic_link"]), follow_redirects=True)
        pending_msgs = pending.get("/api/messages").json()["messages"]
        self.assertFalse(any(m["subject"] == "Members only" for m in pending_msgs))

    def test_individual_message_stays_isolated_from_late_joiners(self):
        admin = _admin()
        target_inv = _create_invite(admin, "Target", "target@example.com")
        target = _admit_personal(target_inv["magic_link"], "Target", "target@example.com")

        parts = admin.get("/api/admin/messaging/participants").json()["participants"]
        tid = next(p for p in parts if p["email"] == "target@example.com")["id"]
        admin.post("/api/admin/messaging/person",
                   json={"invite_id": tid, "subject": "Private line", "body": "Only for Target."})

        # A participant admitted AFTER the personal message must never see it,
        # even though announcements are now audience-resolved.
        other_inv = _create_invite(admin, "Other", "other@example.com")
        other = _admit_personal(other_inv["magic_link"], "Other", "other@example.com")

        self.assertTrue(any(m["subject"] == "Private line" for m in target.get("/api/messages").json()["messages"]))
        self.assertFalse(any(m["subject"] == "Private line" for m in other.get("/api/messages").json()["messages"]))


class AnnouncementHistoryTests(unittest.TestCase):
    """Admin announcement history + individual deletion. Scoped strictly to
    general beta in-app announcements: never email-all records, personal
    messages, invitations, or participant data."""

    def _post_announcement(self, admin, subject, body):
        r = admin.post("/api/admin/messaging/announce", json={"subject": subject, "body": body})
        self.assertEqual(r.status_code, 200, r.text)

    def test_history_requires_admin(self):
        anon = TestClient(server.app)
        self.assertEqual(anon.get("/api/admin/messaging/announcements").status_code, 401)
        self.assertEqual(anon.delete("/api/admin/messaging/announcements/1").status_code, 401)

    def test_history_lists_announcements_newest_first(self):
        admin = _admin()
        inv = _create_invite(admin, "Ivy", "ivy@example.com")
        _admit_personal(inv["magic_link"], "Ivy", "ivy@example.com")
        self._post_announcement(admin, "First up", "One.")
        self._post_announcement(admin, "Second up", "Two.")

        items = admin.get("/api/admin/messaging/announcements").json()["announcements"]
        subjects = [a["subject"] for a in items]
        self.assertIn("First up", subjects)
        self.assertIn("Second up", subjects)
        # Newest first: "Second up" precedes "First up".
        self.assertLess(subjects.index("Second up"), subjects.index("First up"))
        # Each item carries enough context to identify it, no addresses.
        top = items[0]
        for key in ("message_id", "subject", "body", "created_at", "recipients"):
            self.assertIn(key, top)
        self.assertNotIn("ivy@example.com", admin.get("/api/admin/messaging/announcements").text)

    def test_delete_removes_announcement_from_feed_for_all(self):
        admin = _admin()
        inv = _create_invite(admin, "Jem", "jem@example.com")
        client = _admit_personal(inv["magic_link"], "Jem", "jem@example.com")
        self._post_announcement(admin, "Ephemeral", "Here then gone.")

        # Visible before deletion.
        subjects = {m["subject"] for m in client.get("/api/messages").json()["messages"]}
        self.assertIn("Ephemeral", subjects)

        mid = next(a["message_id"] for a in
                   admin.get("/api/admin/messaging/announcements").json()["announcements"]
                   if a["subject"] == "Ephemeral")
        r = admin.delete(f"/api/admin/messaging/announcements/{mid}")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["ok"])

        # Gone from the participant feed and from the admin history.
        subjects_after = {m["subject"] for m in client.get("/api/messages").json()["messages"]}
        self.assertNotIn("Ephemeral", subjects_after)
        hist = {a["subject"] for a in admin.get("/api/admin/messaging/announcements").json()["announcements"]}
        self.assertNotIn("Ephemeral", hist)

    def test_deleted_announcement_hidden_from_late_joiner(self):
        admin = _admin()
        seed = _create_invite(admin, "Kai", "kai@example.com")
        _admit_personal(seed["magic_link"], "Kai", "kai@example.com")
        self._post_announcement(admin, "Vanish", "Not for latecomers.")
        mid = next(a["message_id"] for a in
                   admin.get("/api/admin/messaging/announcements").json()["announcements"]
                   if a["subject"] == "Vanish")
        self.assertEqual(admin.delete(f"/api/admin/messaging/announcements/{mid}").status_code, 200)

        # Someone admitted AFTER the deletion must never see it.
        late_inv = _create_invite(admin, "Lee", "lee@example.com")
        late = _admit_personal(late_inv["magic_link"], "Lee", "lee@example.com")
        late_subjects = {m["subject"] for m in late.get("/api/messages").json()["messages"]}
        self.assertNotIn("Vanish", late_subjects)

    def test_delete_rejects_nonexistent(self):
        admin = _admin()
        self.assertEqual(admin.delete("/api/admin/messaging/announcements/999999").status_code, 404)

    def test_delete_rejects_personal_message(self):
        admin = _admin()
        inv = _create_invite(admin, "Mo", "mo@example.com")
        _admit_personal(inv["magic_link"], "Mo", "mo@example.com")
        pid = next(p for p in admin.get("/api/admin/messaging/participants").json()["participants"]
                   if p["email"] == "mo@example.com")["id"]
        r = admin.post("/api/admin/messaging/person",
                       json={"invite_id": pid, "subject": "Private", "body": "Only Mo."})
        self.assertEqual(r.status_code, 200, r.text)
        personal_mid = r.json()["message_id"]
        # A personal message is not a general announcement — deletion is refused
        # and it is never listed in the history.
        self.assertEqual(admin.delete(f"/api/admin/messaging/announcements/{personal_mid}").status_code, 404)
        hist_ids = {a["message_id"] for a in
                    admin.get("/api/admin/messaging/announcements").json()["announcements"]}
        self.assertNotIn(personal_mid, hist_ids)

    def test_delete_rejects_email_all_record(self):
        admin = _admin()
        inv = _create_invite(admin, "Nia", "nia@example.com")
        _admit_personal(inv["magic_link"], "Nia", "nia@example.com")
        # Post an announcement, then an email. Message ids are globally
        # monotonic, so the email's message id is the announcement's + 1.
        self._post_announcement(admin, "Kept announce", "Stays.")
        ann_mid = next(a["message_id"] for a in
                       admin.get("/api/admin/messaging/announcements").json()["announcements"]
                       if a["subject"] == "Kept announce")
        with mock.patch.object(server, "_smtp_configured", return_value=True), \
             mock.patch.object(server, "_send_communication_email", return_value=("sent", "")):
            r = admin.post("/api/admin/messaging/email",
                           json={"subject": "Mail", "body": "Emailed only."})
        self.assertEqual(r.status_code, 200, r.text)
        email_mid = ann_mid + 1
        # The email-all record is never listed among announcements...
        hist = admin.get("/api/admin/messaging/announcements").json()["announcements"]
        self.assertNotIn("Mail", {a["subject"] for a in hist})
        self.assertNotIn(email_mid, {a["message_id"] for a in hist})
        # ...and can never be deleted through the announcements endpoint.
        self.assertEqual(admin.delete(f"/api/admin/messaging/announcements/{email_mid}").status_code, 404)

    def test_confirmation_and_history_wired_in_admin_ui(self):
        with open(os.path.join(os.path.dirname(__file__), "admin.html"), encoding="utf-8") as f:
            html = f.read()
        # History surface + per-item delete with a confirmation dialog.
        self.assertIn('data-testid="announcement-history-card"', html)
        self.assertIn('data-testid="announcement-list"', html)
        # Per-item delete buttons are created dynamically and tagged in JS.
        self.assertIn("'announcement-delete'", html)
        self.assertIn('id="ann-confirm"', html)
        self.assertIn('data-testid="announcement-confirm-go"', html)
        self.assertIn("/api/admin/messaging/announcements", html)
        # Deletion goes through the DELETE verb.
        self.assertIn("method: 'DELETE'", html)


class PersonTests(unittest.TestCase):
    def test_person_message_isolated_across_sessions(self):
        admin = _admin()
        inv_a = _create_invite(admin, "Cy", "cy@example.com")
        client_a = _admit_personal(inv_a["magic_link"], "Cy", "cy@example.com")
        camp = _create_campaign(admin, "Autumn group")
        client_b = _admit_campaign(camp["campaign_link"], "Dev", "dev@example.com")

        # Resolve participant A's invite id from the admin participant list.
        parts = admin.get("/api/admin/messaging/participants").json()["participants"]
        target = next(p for p in parts if p["email"] == "cy@example.com")

        r = admin.post("/api/admin/messaging/person",
                       json={"invite_id": target["id"], "subject": "Just for you", "body": "A private note."})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["destination"], "person")

        # A sees the individual message.
        msgs_a = client_a.get("/api/messages").json()["messages"]
        self.assertTrue(any(m["subject"] == "Just for you" and m["kind"] == "individual" for m in msgs_a))

        # B (an independent campaign participant) must NOT see it.
        msgs_b = client_b.get("/api/messages").json()["messages"]
        self.assertFalse(any(m["subject"] == "Just for you" for m in msgs_b))

    def test_person_rejects_unadmitted_and_campaign(self):
        admin = _admin()
        # Unadmitted invite id.
        inv = _create_invite(admin, "NoAdmit", "noadmit@example.com")
        invite_id = inv["invite"]["id"]
        r = admin.post("/api/admin/messaging/person",
                       json={"invite_id": invite_id, "body": "hi"})
        self.assertEqual(r.status_code, 400, r.text)

        # Campaign template id.
        camp = _create_campaign(admin, "Some campaign")
        camp_id = camp["campaign"]["id"]
        r = admin.post("/api/admin/messaging/person",
                       json={"invite_id": camp_id, "body": "hi"})
        self.assertEqual(r.status_code, 400, r.text)

        # Missing recipient.
        r = admin.post("/api/admin/messaging/person", json={"body": "hi"})
        self.assertEqual(r.status_code, 400, r.text)


class EmailTests(unittest.TestCase):
    def test_email_fail_closed_when_smtp_unconfigured(self):
        admin = _admin()
        inv = _create_invite(admin, "Eli", "eli@example.com")
        _admit_personal(inv["magic_link"], "Eli", "eli@example.com")

        with mock.patch.object(server, "_smtp_configured", return_value=False), \
             mock.patch.object(server, "_send_communication_email") as sender:
            r = admin.post("/api/admin/messaging/email",
                           json={"subject": "Beta note", "body": "Hello all."})
        self.assertEqual(r.status_code, 503, r.text)
        # No delivery attempted — honest about being unconfigured.
        sender.assert_not_called()

    def test_email_sends_individually_and_reports_counts_without_addresses(self):
        admin = _admin()
        i1 = _create_invite(admin, "Fay", "fay@example.com")
        _admit_personal(i1["magic_link"], "Fay", "fay@example.com")
        i2 = _create_invite(admin, "Gus", "gus@example.com")
        _admit_personal(i2["magic_link"], "Gus", "gus@example.com")

        with mock.patch.object(server, "_smtp_configured", return_value=True), \
             mock.patch.object(server, "_send_communication_email", return_value=("sent", "")) as sender:
            r = admin.post("/api/admin/messaging/email",
                           json={"subject": "Beta note", "body": "Hello all."})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["destination"], "email")
        self.assertGreaterEqual(body["email_sent"], 2)
        # One send per recipient (individual — no BCC leak).
        self.assertGreaterEqual(sender.call_count, 2)
        # No addresses leaked into the client response.
        self.assertNotIn("fay@example.com", r.text)
        self.assertNotIn("gus@example.com", r.text)

    def test_email_dedupes_before_sending(self):
        admin = _admin()
        i1 = _create_invite(admin, "Same One", "same@example.com")
        _admit_personal(i1["magic_link"], "Same One", "same@example.com")
        i2 = _create_invite(admin, "Same Two", "SAME@example.com")
        _admit_personal(i2["magic_link"], "Same Two", "SAME@example.com")

        with mock.patch.object(server, "_smtp_configured", return_value=True), \
             mock.patch.object(server, "_send_communication_email", return_value=("sent", "")) as sender:
            r = admin.post("/api/admin/messaging/email",
                           json={"body": "One only."})
        self.assertEqual(r.status_code, 200, r.text)
        addressed = [c.args[0] for c in sender.call_args_list]
        # The shared address is emailed exactly once.
        self.assertEqual(sum(1 for a in addressed if a.lower() == "same@example.com"), 1)


class LegacyCompatTests(unittest.TestCase):
    def test_legacy_broadcast_still_visible_in_hub(self):
        admin = _admin()
        inv = _create_invite(admin, "Hal", "hal@example.com")
        client = _admit_personal(inv["magic_link"], "Hal", "hal@example.com")

        # The legacy Message-all broadcast endpoint remains functional and its
        # in-app deliveries still surface in the participant's feed.
        r = admin.post("/api/admin/broadcast",
                       json={"subject": "Legacy", "body": "Old broadcast.", "channel": "in_app"})
        self.assertEqual(r.status_code, 200, r.text)
        msgs = client.get("/api/messages").json()["messages"]
        self.assertTrue(any(m["subject"] == "Legacy" for m in msgs))


class SeparationTests(unittest.TestCase):
    def test_message_all_removed_from_invitations_admin_ui(self):
        # The old "Message all" composer must no longer live inside Invitations,
        # and per-row Message buttons are gone; messaging is its own tab.
        with open(os.path.join(os.path.dirname(__file__), "admin.html"), encoding="utf-8") as f:
            html = f.read()
        self.assertNotIn('id="message-all"', html)
        self.assertNotIn('data-message=', html)
        self.assertIn('data-tab="messaging"', html)
        self.assertIn('data-testid="tab-messaging"', html)


class PersonDestinationHiddenTests(unittest.TestCase):
    """The per-person in-app destination is temporarily HIDDEN from the admin
    Messaging Center UI (its participant-facing "For you" area is not rendered in
    this beta), while its backend endpoint and data support are PRESERVED."""

    def _admin_html(self) -> str:
        with open(os.path.join(os.path.dirname(__file__), "admin.html"), encoding="utf-8") as f:
            return f.read()

    def test_person_mode_removed_from_admin_ui(self):
        html = self._admin_html()
        # The radio option and recipient picker are gone from the UI.
        self.assertNotIn('data-testid="messaging-mode-person"', html)
        self.assertNotIn('value="person"', html)
        self.assertNotIn('id="msg-person"', html)
        # The two operationally visible destinations remain.
        self.assertIn('data-testid="messaging-mode-announce"', html)
        self.assertIn('data-testid="messaging-mode-email"', html)
        # It is documented as dormant, not simply deleted.
        self.assertIn("DORMANT", html)

    def test_person_endpoint_backend_still_preserved(self):
        # Backend compatibility: the endpoint still works for a valid recipient,
        # so the destination can be reactivated later with no server change.
        admin = _admin()
        inv = _create_invite(admin, "Dorm", "dorm@example.com")
        client = _admit_personal(inv["magic_link"], "Dorm", "dorm@example.com")
        parts = admin.get("/api/admin/messaging/participants").json()["participants"]
        pid = next(p for p in parts if p["email"] == "dorm@example.com")["id"]
        r = admin.post("/api/admin/messaging/person",
                       json={"invite_id": pid, "subject": "Kept", "body": "Still routable."})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["destination"], "person")
        # It is stored as an individual message, still returned by the API.
        msgs = client.get("/api/messages").json()["messages"]
        self.assertTrue(any(m["subject"] == "Kept" and m["kind"] == "individual" for m in msgs))


if __name__ == "__main__":
    unittest.main(verbosity=2)
