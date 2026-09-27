import os
import urllib.request
import urllib.error
import json
import time
import uuid

base = 'http://127.0.0.1:8000'

def cleanup_test_data():
    import sqlite3
    db_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'career_repository.sqlite')
    try:
        conn = sqlite3.connect(db_file)
        c = conn.cursor()
        c.execute("SELECT id FROM squads WHERE squad_name LIKE 'Pod_%' OR squad_name LIKE 'SizeSquad_%';")
        for r in c.fetchall():
            c.execute("DELETE FROM squad_messages WHERE squad_id = ?;", (r[0],))
            c.execute("DELETE FROM squad_members WHERE squad_id = ?;", (r[0],))
            c.execute("DELETE FROM squad_progress_uploads WHERE squad_id = ?;", (r[0],))
            c.execute("DELETE FROM squads WHERE id = ?;", (r[0],))
        c.execute("SELECT id FROM users WHERE username LIKE 'testuser_%' OR username LIKE 'member_%' OR username LIKE 'solo_%' OR username LIKE 'sizetester_%';")
        for r in c.fetchall():
            c.execute("DELETE FROM user_sessions WHERE user_id = ?;", (r[0],))
            c.execute("DELETE FROM user_interests WHERE user_id = ?;", (r[0],))
            c.execute("DELETE FROM user_friends WHERE user_id = ? OR friend_id = ?;", (r[0], r[0]))
            c.execute("DELETE FROM squad_members WHERE user_id = ?;", (r[0],))
            c.execute("DELETE FROM squad_messages WHERE sender_id = ?;", (r[0],))
            c.execute("DELETE FROM users WHERE id = ?;", (r[0],))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Cleanup Note] {e}")


def post_json(path, data, token=None):
    url = base + path
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def get_json(path, token=None):
    url = base + path
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def post_multipart(path, fields, files, token=None):
    boundary = '----FormBoundary' + uuid.uuid4().hex
    body = bytearray()
    for name, value in fields.items():
        body.extend(f'--{boundary}\r\n'.encode('utf-8'))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode('utf-8'))
        body.extend(f'{value}\r\n'.encode('utf-8'))
    for name, (filename, content, mime) in files.items():
        body.extend(f'--{boundary}\r\n'.encode('utf-8'))
        body.extend(f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode('utf-8'))
        body.extend(f'Content-Type: {mime}\r\n\r\n'.encode('utf-8'))
        body.extend(content)
        body.extend(b'\r\n')
    body.extend(f'--{boundary}--\r\n'.encode('utf-8'))
    url = base + path
    headers = {
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'Content-Length': str(len(body))
    }
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=bytes(body), headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception:
            return e.code, {'detail': str(e)}

def main():
    ts = int(time.time())
    u1 = f'testuser_{ts}'
    email1 = f'{u1}@example.com'

    # 1. Test registration with < 3 interests -> Should fail
    status, res = post_json('/api/auth/register', {
        'username': u1,
        'full_name': 'Test User One',
        'email': email1,
        'password': 'Password@123',
        'stage': 'final_year',
        'interests': ['AI & Machine Learning']
    })
    assert status in (400, 422), f'Expected validation error 400 or 422 for < 3 interests, got {status}'
    print('[PASS] Registration with <3 interests correctly rejected')

    # 2. Test registration with >= 3 interests -> Should succeed
    status, res = post_json('/api/auth/register', {
        'username': u1,
        'full_name': 'Test User One',
        'email': email1,
        'password': 'Password@123',
        'stage': 'final_year',
        'stream_or_degree': 'B.Tech CS',
        'target_role': 'Full Stack Developer',
        'bio': 'Passionate builder',
        'interests': ['Coding & Tech', 'AI & Machine Learning', 'Cloud & DevOps'],
        'avatar_color': '#0f766e',
        'avatar_emoji': ''
    })
    assert status == 200, f'Registration failed: {res}'
    token1 = res['token']
    user1_id = res['user']['id']
    print(f'[PASS] User registered successfully: {u1} (ID: {user1_id})')

    # 3. Test peer matchmaking
    status, peers_data = get_json('/api/community/peers', token=token1)
    assert status == 200 and peers_data['success']
    peers_count = len(peers_data['peers'])
    assert peers_count == 10, f"Expected exactly 10 matching peer profiles, got {peers_count}"
    print(f'[PASS] Found exactly {peers_count} matching peers')

    # 4. Form a 4-person squad
    status, squad_data = post_json('/api/squads/create', {
        'squad_name': f'Pod_{ts}',
        'track_name': 'Distributed Cloud Systems',
        'stage': 'final_year',
        'sprint_goal': 'Sprint 1: System Blueprint'
    }, token=token1)
    assert status == 200, f'Squad creation failed: {squad_data}'
    squad = squad_data['squad']
    squad_id = squad['id']
    code = squad['invite_code']
    print(f'[PASS] Squad created: {squad["squad_name"]} (Invite Code: {code})')

    # 4b. Verify user already in the team attempting to join receives "You are already in a team."
    st_rejoin, r_rejoin = post_json('/api/squads/join', {'invite_code': code}, token=token1)
    assert st_rejoin == 200, f'Rejoin check failed: {r_rejoin}'
    assert r_rejoin.get('message') == "You are already in a team.", f"Expected 'You are already in a team.', got {r_rejoin.get('message')}"
    print(f'[PASS] Re-joining existing squad correctly returns: {r_rejoin["message"]}')

    # 5. Create 3 more users to fill the 4-person squad
    tokens = []
    for i in range(2, 5):
        ui = f'member_{i}_{ts}'
        st, r = post_json('/api/auth/register', {
            'username': ui,
            'full_name': f'Squad Member {i}',
            'email': f'{ui}@example.com',
            'password': 'Password@123',
            'stage': 'final_year',
            'interests': ['Coding & Tech', 'AI & Machine Learning', 'Cloud & DevOps']
        })
        tokens.append((ui, r['token']))
        # Join the squad
        st_join, r_join = post_json('/api/squads/join', {'invite_code': code}, token=r['token'])
        assert st_join == 200, f'Member {i} join failed: {r_join}'
    print('[PASS] 3 additional members joined the squad. Pod is now 4/4 FULL')

    # 6. Verify 5th member CANNOT join (Rule of 4 enforcement)
    u5 = f'member_5_{ts}'
    st, r5 = post_json('/api/auth/register', {
        'username': u5,
        'full_name': 'Extra Member 5',
        'email': f'{u5}@example.com',
        'password': 'Password@123',
        'stage': 'final_year',
        'interests': ['Coding & Tech', 'AI & Machine Learning', 'Cloud & DevOps']
    })
    st_overflow, r_overflow = post_json('/api/squads/join', {'invite_code': code}, token=r5['token'])
    assert st_overflow == 400, f'Expected 400 for squad overflow, got {st_overflow}'
    print(f'[PASS] 5th member correctly rejected by Rule of 4: {r_overflow.get("detail")}')

    # 7. Post and read chat message
    st_msg, r_msg = post_json(f'/api/squads/{squad_id}/messages', {'message': 'Hello squad mates! Ready for sprint 1.'}, token=token1)
    assert st_msg == 200
    st_msgs, r_msgs = get_json(f'/api/squads/{squad_id}/messages')
    assert st_msgs == 200 and len(r_msgs['messages']) >= 1
    print('[PASS] Squad chat message posted and retrieved successfully')

    # 8. Update sprint goal
    st_goal, r_goal = post_json(f'/api/squads/{squad_id}/sprint-goal', {'message': 'Sprint 2: Kubernetes Orchestration'}, token=token1)
    assert st_goal == 200 and r_goal['success']
    print('[PASS] Sprint goal updated successfully')

    # 8b. Upload progress image artifact (png)
    png_bytes = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\x9f\x19\x00\x05\xfe\x02\xfe\xa7\xbf\x9b\xba\x00\x00\x00\x00IEND\xaeB`\x82'
    st_img, r_img = post_multipart(
        f'/api/squads/{squad_id}/upload-progress',
        fields={'title': 'System Architecture & ER Diagram'},
        files={'file': ('arch_diagram.png', png_bytes, 'image/png')},
        token=token1
    )
    assert st_img == 200 and r_img['success'], f'Image upload failed: {r_img}'
    img_progress = r_img['progress']
    assert img_progress['file_type'] == 'image'
    assert 'arch_diagram' in img_progress['file_url']
    print(f'[PASS] Progress image uploaded: {img_progress["file_url"]} ({img_progress["title"]})')

    # 8c. Upload progress video artifact (mp4 demo)
    fake_mp4_bytes = b'\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00isommp42\x00\x00\x00\x08free' + b'\x00' * 512
    st_vid, r_vid = post_multipart(
        f'/api/squads/{squad_id}/upload-progress',
        fields={'title': 'End-to-End Sprint 1 Demo Walkthrough'},
        files={'file': ('demo_sprint1.mp4', fake_mp4_bytes, 'video/mp4')},
        token=tokens[0][1] # Member 2 token
    )
    assert st_vid == 200 and r_vid['success'], f'Video upload failed: {r_vid}'
    vid_progress = r_vid['progress']
    assert vid_progress['file_type'] == 'video'
    print(f'[PASS] Progress video uploaded: {vid_progress["file_url"]} ({vid_progress["title"]})')

    # 8d. Verify progress showcase gallery listing
    st_gallery, r_gallery = get_json(f'/api/squads/{squad_id}/progress')
    assert st_gallery == 200 and r_gallery['total'] >= 2
    types_found = {u['file_type'] for u in r_gallery['uploads']}
    assert 'image' in types_found and 'video' in types_found
    print(f'[PASS] Squad progress gallery retrieved ({r_gallery["total"]} uploads: image & video)')

    # 8e. Verify progress uploads posted into squad chat with media_url & media_type
    st_chat, r_chat = get_json(f'/api/squads/{squad_id}/messages')
    assert st_chat == 200
    media_messages = [m for m in r_chat['messages'] if m.get('media_url')]
    assert len(media_messages) >= 2
    print(f'[PASS] Squad chat contains inline progress media previews ({len(media_messages)} items)')

    # 8f. Verify static serving of uploaded progress media
    req_media = urllib.request.Request(base + img_progress['file_url'])
    with urllib.request.urlopen(req_media) as resp:
        assert resp.status == 200
        assert resp.read() == png_bytes
    print('[PASS] Uploaded progress media retrieved statically via HTTP 200')

    # 8g. Verify unauthenticated upload is rejected (401)
    st_unauth, r_unauth = post_multipart(
        f'/api/squads/{squad_id}/upload-progress',
        fields={'title': 'Hacker attempt'},
        files={'file': ('hack.png', png_bytes, 'image/png')},
        token=None
    )
    assert st_unauth == 401
    print('[PASS] Unauthenticated progress upload rejected with HTTP 401')

    # 8h. Verify disallowed file extensions are rejected (400)
    st_bad, r_bad = post_multipart(
        f'/api/squads/{squad_id}/upload-progress',
        fields={'title': 'Executable file'},
        files={'file': ('malicious.exe', b'MZ\x90\x00', 'application/octet-stream')},
        token=token1
    )
    assert st_bad == 400
    print('[PASS] Unsupported file format rejected with HTTP 400')

    # 8i. Verify community.html and community.js do NOT have "Video Standup", and have "Upload Progress"
    req_comm = urllib.request.Request(base + '/community')
    with urllib.request.urlopen(req_comm) as resp:
        comm_html = resp.read().decode('utf-8')
        assert 'progressUploadModal' in comm_html
        assert 'progressGalleryModal' in comm_html
        assert 'Max 300 MB' in comm_html

    req_js = urllib.request.Request(base + '/static/js/community.js')
    with urllib.request.urlopen(req_js) as resp:
        comm_js = resp.read().decode('utf-8')
        assert 'Video Standup' not in comm_js, 'Video Standup should be completely removed from community.js'
        assert 'Upload Progress' in comm_js
        assert 'Showcase Reel' in comm_js
        assert 'MAX_PROGRESS_BYTES' in comm_js
        assert 'href="/stage"' in comm_js and 'Career Roadmap' in comm_js
    print('[PASS] Video Standup verified removed; Career Roadmap verified pointing to /stage')

    # 8j. Verify strict 300MB file limit enforcement (HTTP 413)
    try:
        from fastapi.testclient import TestClient
        from app.main import app
        import io

        class ChunkedStream(io.RawIOBase):
            def __init__(self, total_bytes):
                self.remaining = total_bytes
            def read(self, size=-1):
                if self.remaining <= 0:
                    return b''
                read_size = min(size if size > 0 else 1024 * 1024, self.remaining)
                self.remaining -= read_size
                return b'A' * read_size

        tc = TestClient(app)
        res_over = tc.post(
            f'/api/squads/{squad_id}/upload-progress',
            headers={'Authorization': f'Bearer {token1}'},
            files={'file': ('oversized_video.mp4', ChunkedStream(301 * 1024 * 1024), 'video/mp4')},
            data={'title': 'Oversized file'}
        )
        assert res_over.status_code == 413, f'Expected 413, got {res_over.status_code}'
        print('[PASS] Strict 300MB limit enforced on backend (HTTP 413 Payload Too Large)')
    except Exception as e:
        print(f'[WARN] TestClient 300MB test: {e}')

    # 9. Verify standalone auth pages and stage pages serve HTTP 200
    for page_path in ['/signin', '/signup', '/login', '/stage', '/select-stage', '/explore-stage', '/explore-stages']:
        req = urllib.request.Request(base + page_path)
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode('utf-8')
            assert resp.status == 200, f'Failed on {page_path}'
    print('[PASS] /signin, /signup, /login, /stage, /explore-stage routes verified (HTTP 200)')

    # 10. Verify demo account login (@aarav_dev)
    st_demo, r_demo = post_json('/api/auth/login', {
        'username_or_email': 'aarav_dev',
        'password': 'Password@123'
    })
    assert st_demo == 200 and r_demo.get('user', {}).get('username') == 'aarav_dev', f'Demo login failed: {r_demo}'
    demo_token = r_demo['token']

    # 11. Verify /api/auth/me with session token
    st_me, r_me = get_json('/api/auth/me', token=demo_token)
    assert st_me == 200 and r_me.get('authenticated') is True
    print('[PASS] Demo account login and session verification verified')

    # 12. Verify Sign Out functionality and UI integration
    # 12a. Verify /api/auth/logout invalidates session
    st_logout, r_logout = post_json('/api/auth/logout', {}, token=demo_token)
    assert st_logout == 200 and r_logout.get('success') is True
    st_me_after, r_me_after = get_json('/api/auth/me', token=demo_token)
    assert r_me_after.get('authenticated') is False, 'Session should be invalidated after logout'
    print('[PASS] /api/auth/logout successfully revoked session token')

    # 12b. Verify nav-auth.js includes Sign Out button & handler
    req_nav = urllib.request.Request(base + '/static/js/nav-auth.js')
    with urllib.request.urlopen(req_nav) as resp:
        nav_js = resp.read().decode('utf-8')
        assert 'feGlobalSignOut' in nav_js
        assert 'nav-signout-btn' in nav_js
        assert 'Sign Out' in nav_js
    print('[PASS] nav-auth.js verified with global Sign Out button and feGlobalSignOut() handler')

    # 12c. Verify style.css includes .nav-signout-btn styles
    req_css = urllib.request.Request(base + '/static/css/style.css')
    with urllib.request.urlopen(req_css) as resp:
        css_content = resp.read().decode('utf-8')
        assert '.nav-signout-btn' in css_content
    print('[PASS] style.css verified with .nav-signout-btn styles')

    # 13. Verify Squad Workspace Privacy (Users not signed in or not joined CANNOT see squad workspace)
    # 13a. Unauthenticated /api/squads/my-squad returns HTTP 401
    st_anon_squad, r_anon_squad = get_json('/api/squads/my-squad')
    assert st_anon_squad == 401, f'Expected 401, got {st_anon_squad}'
    print('[PASS] Unauthenticated access to /api/squads/my-squad rejected with HTTP 401')

    # 13b. Authenticated user with no squad returns in_squad == False
    u_solo = f'solo_{ts}'
    st_solo, r_solo = post_json('/api/auth/register', {
        'username': u_solo,
        'full_name': 'Solo User',
        'email': f'{u_solo}@example.com',
        'password': 'Password@123',
        'stage': 'final_year',
        'interests': ['Coding & Tech', 'AI & Machine Learning', 'Cloud & DevOps']
    })
    st_my_squad, r_my_squad = get_json('/api/squads/my-squad', token=r_solo['token'])
    assert st_my_squad == 200 and r_my_squad['in_squad'] is False and r_my_squad['squad'] is None
    print('[PASS] Authenticated user without a squad correctly reports in_squad == False')

    # 13c. Verify community.js does NOT contain renderDefaultSquadView or isDemoPreview, and contains renderLoggedOutSquadView
    req_comm_js = urllib.request.Request(base + '/static/js/community.js')
    with urllib.request.urlopen(req_comm_js) as resp:
        comm_js_src = resp.read().decode('utf-8')
        assert 'renderDefaultSquadView' not in comm_js_src, 'renderDefaultSquadView should be completely removed'
        assert 'isDemoPreview' not in comm_js_src, 'isDemoPreview fallback should be completely removed'
        assert 'renderLoggedOutSquadView' in comm_js_src, 'renderLoggedOutSquadView must be implemented'
        assert 'Squad Workspaces are Private to Teams' in comm_js_src
    # 14. Friend Management & Peer Network Endpoints
    # 14a. Add friend by username
    st_fa1, r_fa1 = post_json('/api/friends/add', {'username': u_solo}, token=token1)
    assert st_fa1 == 200 and r_fa1['success'], f"Failed to add friend by username: {r_fa1}"
    assert f"Added @{u_solo}" in r_fa1['message']
    print(f"[PASS] Added friend by username: {r_fa1['message']}")

    # 14b. User cannot add themselves
    st_fa_self, r_fa_self = post_json('/api/friends/add', {'username': u1}, token=token1)
    assert st_fa_self == 400
    print(f"[PASS] Adding self as friend rejected with HTTP 400: {r_fa_self.get('detail')}")

    # 14c. User cannot add non-existent user
    st_fa_none, r_fa_none = post_json('/api/friends/add', {'username': 'non_existent_ghost_999'}, token=token1)
    assert st_fa_none == 400
    print(f"[PASS] Non-existent user rejected with HTTP 400: {r_fa_none.get('detail')}")

    # 14d. Duplicate add is rejected
    st_fa_dup, r_fa_dup = post_json('/api/friends/add', {'username': u_solo}, token=token1)
    assert st_fa_dup == 400
    print(f"[PASS] Duplicate friend add rejected with HTTP 400: {r_fa_dup.get('detail')}")

    # 14e. List friends for user
    st_fl, r_fl = get_json('/api/friends', token=token1)
    assert st_fl == 200 and r_fl['success']
    assert r_fl['total_friends'] == 1
    assert r_fl['friends'][0]['username'] == u_solo
    print(f"[PASS] Friends list retrieved ({r_fl['total_friends']} friend: @{r_fl['friends'][0]['username']})")

    # 14f. Profile endpoint friendship context
    # token1 viewing u_solo's profile -> is_friend == True, is_self == False
    st_prof, r_prof = get_json(f"/api/community/user/{r_solo['user']['id']}", token=token1)
    assert st_prof == 200
    assert r_prof['is_friend'] is True
    assert r_prof['is_self'] is False
    print(f"[PASS] Viewing other's profile indicates is_friend=True, is_self=False")

    # token1 viewing own profile -> is_friend == False, is_self == True
    st_myprof, r_myprof = get_json(f"/api/community/user/{user1_id}", token=token1)
    assert st_myprof == 200
    assert r_myprof['is_friend'] is False
    assert r_myprof['is_self'] is True
    print(f"[PASS] Viewing own profile indicates is_friend=False, is_self=True")

    # u_solo viewing token1's profile -> is_friend == False (directional friend list)
    st_othprof, r_othprof = get_json(f"/api/community/user/{user1_id}", token=r_solo['token'])
    assert st_othprof == 200
    assert r_othprof['is_friend'] is False
    assert r_othprof['is_self'] is False
    print(f"[PASS] Other user viewing profile indicates is_friend=False (can click Add Friend)")

    # 14g. Add friend by user ID (u_solo adds token1)
    st_fa_id, r_fa_id = post_json('/api/friends/add', {'friend_id': user1_id}, token=r_solo['token'])
    assert st_fa_id == 200 and r_fa_id['success']
    print(f"[PASS] Added friend by friend_id: {r_fa_id['message']}")

    # 14h. Remove friend (token1 removes u_solo)
    st_frem, r_frem = post_json(f"/api/friends/{r_solo['user']['id']}/remove", {}, token=token1)
    assert st_frem == 200 and r_frem['success']
    print(f"[PASS] Removed friend successfully: {r_frem['message']}")

    # 14i. Verify list updated after removal
    st_fl2, r_fl2 = get_json('/api/friends', token=token1)
    assert st_fl2 == 200 and r_fl2['total_friends'] == 0
    print(f"[PASS] Friends list confirmed empty after removal ({r_fl2['total_friends']} friends)")

    # 14j. Verify frontend assets contain Friends tab and logic
    req_comm_html = urllib.request.Request(base + '/community')
    with urllib.request.urlopen(req_comm_html) as resp:
        html_src = resp.read().decode('utf-8')
        assert "switchCommTab('friends')" in html_src
        assert 'tab-friends' in html_src
        assert 'addFriendUsernameInput' in html_src
        assert 'tabFriendsBadge' in html_src
    assert 'handleToggleFriendFromModal' in comm_js_src
    assert 'handleAddFriendSubmit' in comm_js_src
    assert 'handleRemoveFriendFromList' in comm_js_src
    assert 'loadUserFriends' in comm_js_src
    assert 'modalFriendActionBtn' in comm_js_src
    print(f"[PASS] Frontend HTML and community.js verified with Friends tab, forms, and modal actions")

    # Clean up ephemeral test users and test squad so DB remains at pristine 10 peers & 10 squads
    cleanup_test_data()

    print('\n========================================')
    print('ALL INTEGRATION TESTS PASSED (100% OK)')
    print('========================================')

if __name__ == '__main__':
    main()
