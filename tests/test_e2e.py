import urllib.request
import urllib.error
import json
import time

base = 'http://127.0.0.1:8000'

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
    print(f'[PASS] Found {peers_count} matching peers')

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

    print('\n========================================')
    print('ALL INTEGRATION TESTS PASSED (100% OK)')
    print('========================================')

if __name__ == '__main__':
    main()
