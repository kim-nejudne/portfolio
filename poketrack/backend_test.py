"""Comprehensive backend API tests for PokéTrack."""
import requests
import sys
from datetime import datetime

BASE_URL = "https://evolution-hub-20.preview.emergentagent.com/api"

class PokeTrackTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.token2 = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.user2_id = None
        self.team_id = None
        self.project_id = None
        self.invite_token = None
        self.pokemon_id = None

    def log(self, msg):
        print(f"  {msg}")

    def test(self, name, method, endpoint, expected_status, data=None, token=None, params=None):
        """Run a single API test."""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if token or self.token:
            headers['Authorization'] = f'Bearer {token or self.token}'

        self.tests_run += 1
        print(f"\n🔍 Test {self.tests_run}: {name}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, params=params, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, params=params, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASS - Status: {response.status_code}")
                try:
                    return True, response.json()
                except Exception:
                    return True, {}
            else:
                self.log(f"❌ FAIL - Expected {expected_status}, got {response.status_code}")
                try:
                    self.log(f"   Response: {response.json()}")
                except Exception:
                    self.log(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            self.log(f"❌ FAIL - Error: {str(e)}")
            return False, {}

    def run_all_tests(self):
        print("=" * 80)
        print("POKETRACK BACKEND API TESTS")
        print("=" * 80)

        # ========== AUTH TESTS ==========
        print("\n" + "=" * 80)
        print("AUTH TESTS")
        print("=" * 80)

        # Test 1: Sign up user 1
        timestamp = datetime.now().strftime('%H%M%S%f')
        email1 = f"test_user_{timestamp}@example.com"
        success, resp = self.test(
            "Sign up user 1",
            "POST",
            "auth/sign-up",
            200,
            data={"email": email1, "name": "Test User 1", "password": "password123"}
        )
        if success:
            self.token = resp.get('token')
            self.user_id = resp.get('user', {}).get('id')
            self.log(f"   User ID: {self.user_id}")

        # Test 2: Sign up user 2 (for invite tests)
        email2 = f"test_user2_{timestamp}@example.com"
        success, resp = self.test(
            "Sign up user 2",
            "POST",
            "auth/sign-up",
            200,
            data={"email": email2, "name": "Test User 2", "password": "password123"}
        )
        if success:
            self.token2 = resp.get('token')
            self.user2_id = resp.get('user', {}).get('id')

        # Test 3: Sign in with same credentials
        success, resp = self.test(
            "Sign in user 1",
            "POST",
            "auth/sign-in",
            200,
            data={"email": email1, "password": "password123"}
        )

        # Test 4: Get current user
        success, resp = self.test(
            "Get current user (/me)",
            "GET",
            "auth/me",
            200
        )

        # Test 5: 401 on missing token
        success, resp = self.test(
            "401 on missing token",
            "GET",
            "auth/me",
            401,
            token=""
        )

        # Test 6: 401 on bad token
        success, resp = self.test(
            "401 on bad token",
            "GET",
            "auth/me",
            401,
            token="invalid-token-xyz"
        )

        # ========== TEAMS TESTS ==========
        print("\n" + "=" * 80)
        print("TEAMS TESTS")
        print("=" * 80)

        # Test 7: Create team
        success, resp = self.test(
            "Create team",
            "POST",
            "teams",
            200,
            data={"name": "Test Team Alpha"}
        )
        if success:
            self.team_id = resp.get('id')
            self.log(f"   Team ID: {self.team_id}")

        # Test 8: List teams
        success, resp = self.test(
            "List teams",
            "GET",
            "teams",
            200
        )
        if success and resp:
            self.log(f"   Found {len(resp)} team(s)")

        # Test 9: Get team details
        if self.team_id:
            success, resp = self.test(
                "Get team details",
                "GET",
                f"teams/{self.team_id}",
                200
            )

        # Test 10: Rename team (owner only)
        if self.team_id:
            success, resp = self.test(
                "Rename team (owner)",
                "PATCH",
                f"teams/{self.team_id}",
                200,
                data={"name": "Test Team Beta"}
            )

        # Test 11: List team members
        if self.team_id:
            success, resp = self.test(
                "List team members",
                "GET",
                f"teams/{self.team_id}/members",
                200
            )
            if success and resp:
                self.log(f"   Found {len(resp)} member(s)")

        # ========== INVITES TESTS ==========
        print("\n" + "=" * 80)
        print("INVITES TESTS")
        print("=" * 80)

        # Test 12: Create invite
        if self.team_id:
            success, resp = self.test(
                "Create invite",
                "POST",
                f"teams/{self.team_id}/invites",
                200,
                data={"email": email2}
            )
            if success:
                self.invite_token = resp.get('token')
                self.log(f"   Invite token: {self.invite_token[:20]}...")

        # Test 13: Dedupe - create same invite again
        if self.team_id:
            success, resp = self.test(
                "Dedupe invite (same email)",
                "POST",
                f"teams/{self.team_id}/invites",
                200,
                data={"email": email2}
            )

        # Test 14: Block inviting existing member
        if self.team_id:
            success, resp = self.test(
                "Block inviting existing member",
                "POST",
                f"teams/{self.team_id}/invites",
                400,
                data={"email": email1}
            )

        # Test 15: List invites
        if self.team_id:
            success, resp = self.test(
                "List invites",
                "GET",
                f"teams/{self.team_id}/invites",
                200
            )

        # Test 16: Peek invite (public)
        if self.invite_token:
            success, resp = self.test(
                "Peek invite (public)",
                "GET",
                f"invites/{self.invite_token}",
                200,
                token=""
            )
            if success:
                self.log(f"   Status: {resp.get('status')}")

        # Test 17: Accept invite (requires matching email)
        if self.invite_token and self.token2:
            success, resp = self.test(
                "Accept invite (user 2)",
                "POST",
                f"invites/{self.invite_token}/accept",
                200,
                token=self.token2
            )

        # Test 18: Accept invite again (idempotent)
        if self.invite_token and self.token2:
            success, resp = self.test(
                "Accept invite again (idempotent)",
                "POST",
                f"invites/{self.invite_token}/accept",
                200,
                token=self.token2
            )

        # ========== PROJECTS TESTS ==========
        print("\n" + "=" * 80)
        print("PROJECTS TESTS")
        print("=" * 80)

        # Test 19: Create project
        if self.team_id:
            success, resp = self.test(
                "Create project",
                "POST",
                f"teams/{self.team_id}/projects",
                200,
                data={"name": "Test Project"}
            )
            if success:
                self.project_id = resp.get('id')
                self.log(f"   Project ID: {self.project_id}")
                self.log(f"   xp_per_point: {resp.get('xp_per_point')}")
                self.log(f"   synthetic_evolution_level: {resp.get('synthetic_evolution_level')}")
                self.log(f"   evolution_level_pct: {resp.get('evolution_level_pct')}")

        # Test 20: Get project
        if self.project_id:
            success, resp = self.test(
                "Get project",
                "GET",
                f"projects/{self.project_id}",
                200
            )

        # Test 21: Update project settings
        if self.project_id:
            success, resp = self.test(
                "Update project settings",
                "PATCH",
                f"projects/{self.project_id}",
                200,
                data={"xp_per_point": 10}
            )

        # ========== STARTER PICKER TESTS ==========
        print("\n" + "=" * 80)
        print("STARTER PICKER TESTS")
        print("=" * 80)

        # Test 22: Get starters list
        if self.project_id:
            success, resp = self.test(
                "Get starters list",
                "GET",
                f"projects/{self.project_id}/pokedex/starters",
                200
            )
            if success and resp:
                self.log(f"   Found {len(resp)} starters")

        # Test 23: Pokemon state before pick (should be null)
        if self.project_id:
            success, resp = self.test(
                "Pokemon state before pick (null)",
                "GET",
                f"projects/{self.project_id}/me/pokemon",
                200
            )
            if success and resp is None:
                self.log("   ✓ Correctly returns null before pick")

        # Test 24: Pick Charmander (species_id=4)
        if self.project_id:
            success, resp = self.test(
                "Pick Charmander starter",
                "POST",
                f"projects/{self.project_id}/starter",
                200,
                data={"species_id": 4}
            )
            if success:
                pokemon = resp.get('pokemon', {})
                self.pokemon_id = pokemon.get('id')
                self.log(f"   Pokemon ID: {self.pokemon_id}")
                self.log(f"   Species: {pokemon.get('species_name')}")
                self.log(f"   Level: {pokemon.get('level')}")
                self.log(f"   Picked: {resp.get('picked')}")

        # Test 25: Pick starter again (idempotent - should return picked=False)
        if self.project_id:
            success, resp = self.test(
                "Pick starter again (idempotent)",
                "POST",
                f"projects/{self.project_id}/starter",
                200,
                data={"species_id": 4}
            )
            if success:
                self.log(f"   Picked: {resp.get('picked')} (should be False)")

        # Test 26: Reject non-starter (Eevee = 133)
        if self.project_id:
            success, resp = self.test(
                "Reject non-starter (Eevee)",
                "POST",
                f"projects/{self.project_id}/starter",
                400,
                data={"species_id": 133}
            )

        # Test 27: Pokemon state after pick
        if self.project_id:
            success, resp = self.test(
                "Pokemon state after pick",
                "GET",
                f"projects/{self.project_id}/me/pokemon",
                200
            )
            if success and resp:
                self.log(f"   Species: {resp.get('species_name')}")
                self.log(f"   Level: {resp.get('level')}")
                self.log(f"   Total XP: {resp.get('total_xp')}")

        # ========== TICKETS TESTS ==========
        print("\n" + "=" * 80)
        print("TICKETS TESTS")
        print("=" * 80)

        # Test 28: Create ticket with Fibonacci points (13)
        ticket_ids = []
        if self.project_id:
            success, resp = self.test(
                "Create ticket (13 points, backlog)",
                "POST",
                f"projects/{self.project_id}/tickets",
                200,
                data={
                    "title": "Test Ticket 1",
                    "description": "Test description",
                    "story_points": 13,
                    "status": "backlog"
                }
            )
            if success:
                ticket_ids.append(resp.get('id'))

        # Test 29: Create ticket with non-Fibonacci points (should fail)
        if self.project_id:
            success, resp = self.test(
                "Reject non-Fibonacci points (4)",
                "POST",
                f"projects/{self.project_id}/tickets",
                400,
                data={
                    "title": "Bad Ticket",
                    "story_points": 4,
                    "status": "backlog"
                }
            )

        # Test 30: Create ticket with non-Fibonacci points (7)
        if self.project_id:
            success, resp = self.test(
                "Reject non-Fibonacci points (7)",
                "POST",
                f"projects/{self.project_id}/tickets",
                400,
                data={
                    "title": "Bad Ticket 2",
                    "story_points": 7,
                    "status": "backlog"
                }
            )

        # Test 31: List tickets
        if self.project_id:
            success, resp = self.test(
                "List tickets",
                "GET",
                f"projects/{self.project_id}/tickets",
                200
            )
            if success and resp:
                self.log(f"   Found {len(resp)} ticket(s)")

        # ========== PROGRESSION & EVOLUTION TESTS ==========
        print("\n" + "=" * 80)
        print("PROGRESSION & EVOLUTION TESTS")
        print("=" * 80)

        # Test 32-55: Create 24 done tickets (13 pts each) to reach level 16+
        # Charmander needs 2535 XP for level 16 (medium-slow growth)
        # 13 pts * 10 xp_per_point = 130 XP per ticket
        # 2535 / 130 = ~19.5 tickets, so 20+ tickets should trigger evolution
        print("\n   Creating 24 done tickets to trigger evolution...")
        if self.project_id:
            for i in range(24):
                success, resp = self.test(
                    f"Create done ticket #{i+1} (13 pts)",
                    "POST",
                    f"projects/{self.project_id}/tickets",
                    200,
                    data={
                        "title": f"Evolution Ticket {i+1}",
                        "story_points": 13,
                        "status": "done"
                    }
                )
                if success:
                    ticket_ids.append(resp.get('id'))

        # Test 56: Check Pokemon state after evolution
        if self.project_id:
            success, resp = self.test(
                "Check Pokemon after evolution",
                "GET",
                f"projects/{self.project_id}/me/pokemon",
                200
            )
            if success and resp:
                self.log(f"   Species: {resp.get('species_name')} (should be charmeleon)")
                self.log(f"   Level: {resp.get('level')} (should be ≥16)")
                self.log(f"   Total XP: {resp.get('total_xp')}")
                history = resp.get('evolutions_history', [])
                self.log(f"   Evolution history: {len(history)} evolution(s)")
                if history:
                    for evo in history:
                        self.log(f"     {evo.get('from', {}).get('name')} → {evo.get('to', {}).get('name')} at level {evo.get('at_level')}")

        # ========== REVERSAL & DEVOLUTION TESTS ==========
        print("\n" + "=" * 80)
        print("REVERSAL & DEVOLUTION TESTS")
        print("=" * 80)

        # Test 57: Un-complete tickets to trigger devolution
        if self.project_id and len(ticket_ids) >= 20:
            print("\n   Un-completing 20 tickets to trigger devolution...")
            for i in range(20):
                if i < len(ticket_ids):
                    success, resp = self.test(
                        f"Un-complete ticket #{i+1}",
                        "PATCH",
                        f"projects/{self.project_id}/tickets/{ticket_ids[i]}",
                        200,
                        data={"status": "backlog"}
                    )

        # Test 58: Check Pokemon after devolution
        if self.project_id:
            success, resp = self.test(
                "Check Pokemon after devolution",
                "GET",
                f"projects/{self.project_id}/me/pokemon",
                200
            )
            if success and resp:
                self.log(f"   Species: {resp.get('species_name')} (should be charmander)")
                self.log(f"   Level: {resp.get('level')}")
                self.log(f"   Total XP: {resp.get('total_xp')}")
                history = resp.get('evolutions_history', [])
                self.log(f"   Evolution history: {len(history)} evolution(s) (should be 0)")

        # ========== XP ADJUSTMENT TESTS ==========
        print("\n" + "=" * 80)
        print("XP ADJUSTMENT TESTS")
        print("=" * 80)

        # Test 59: Create a done ticket
        adjustment_ticket_id = None
        if self.project_id:
            success, resp = self.test(
                "Create done ticket for adjustment test",
                "POST",
                f"projects/{self.project_id}/tickets",
                200,
                data={
                    "title": "Adjustment Test Ticket",
                    "story_points": 13,
                    "status": "done"
                }
            )
            if success:
                adjustment_ticket_id = resp.get('id')

        # Test 60: Edit story points on done ticket
        if self.project_id and adjustment_ticket_id:
            success, resp = self.test(
                "Edit story points on done ticket",
                "PATCH",
                f"projects/{self.project_id}/tickets/{adjustment_ticket_id}",
                200,
                data={"story_points": 5}
            )

        # Test 61: Verify XP adjustment
        if self.project_id:
            success, resp = self.test(
                "Verify XP after adjustment",
                "GET",
                f"projects/{self.project_id}/me/pokemon",
                200
            )
            if success and resp:
                self.log(f"   Total XP: {resp.get('total_xp')}")

        # ========== LEADERBOARD TESTS ==========
        print("\n" + "=" * 80)
        print("LEADERBOARD TESTS")
        print("=" * 80)

        # Test 62: Get leaderboard
        if self.project_id:
            success, resp = self.test(
                "Get leaderboard",
                "GET",
                f"projects/{self.project_id}/leaderboard",
                200
            )
            if success and resp:
                self.log(f"   Found {len(resp)} player(s)")
                for player in resp:
                    self.log(f"     Rank {player.get('rank')}: {player.get('user_name')} - Level {player.get('level')}, XP {player.get('total_xp')}")
                # Check if current user is in leaderboard
                user_found = any(p.get('user_id') == self.user_id for p in resp)
                if user_found:
                    self.log("   ✓ Current user found in leaderboard")

        # ========== MEMBERSHIP ENFORCEMENT TESTS ==========
        print("\n" + "=" * 80)
        print("MEMBERSHIP ENFORCEMENT TESTS")
        print("=" * 80)

        # Create a new user who is NOT a team member
        email3 = f"test_outsider_{timestamp}@example.com"
        success, resp = self.test(
            "Sign up outsider user",
            "POST",
            "auth/sign-up",
            200,
            data={"email": email3, "name": "Outsider", "password": "password123"}
        )
        outsider_token = None
        if success:
            outsider_token = resp.get('token')

        # Test 63: Non-member tries to create ticket (should fail)
        if self.project_id and outsider_token:
            success, resp = self.test(
                "Non-member creates ticket (403)",
                "POST",
                f"projects/{self.project_id}/tickets",
                403,
                data={"title": "Unauthorized", "story_points": 5, "status": "backlog"},
                token=outsider_token
            )

        # Test 64: Non-member tries to pick starter (should fail)
        if self.project_id and outsider_token:
            success, resp = self.test(
                "Non-member picks starter (403)",
                "POST",
                f"projects/{self.project_id}/starter",
                403,
                data={"species_id": 4},
                token=outsider_token
            )

        # Test 65: Non-member tries to view pokemon (should fail)
        if self.project_id and outsider_token:
            success, resp = self.test(
                "Non-member views pokemon (403)",
                "GET",
                f"projects/{self.project_id}/me/pokemon",
                403,
                token=outsider_token
            )

        # Test 66: Non-member tries to view leaderboard (should fail)
        if self.project_id and outsider_token:
            success, resp = self.test(
                "Non-member views leaderboard (403)",
                "GET",
                f"projects/{self.project_id}/leaderboard",
                403,
                token=outsider_token
            )

        # ========== PROJECT DELETE TESTS ==========
        print("\n" + "=" * 80)
        print("PROJECT DELETE TESTS")
        print("=" * 80)

        # Test 67: Delete project without confirm_name (should fail)
        if self.project_id:
            success, resp = self.test(
                "Delete project without confirm_name (400)",
                "DELETE",
                f"projects/{self.project_id}",
                400,
                params={"confirm_name": "Wrong Name"}
            )

        # Test 68: Delete project with correct confirm_name
        if self.project_id:
            success, resp = self.test(
                "Delete project with correct confirm_name",
                "DELETE",
                f"projects/{self.project_id}",
                200,
                params={"confirm_name": "Test Project"}
            )

        # ========== SUMMARY ==========
        print("\n" + "=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        print("=" * 80)

        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = PokeTrackTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
