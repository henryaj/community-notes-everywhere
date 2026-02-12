require "rails_helper"

RSpec.describe "Profiles", type: :request do
  describe "GET /u/:twitter_handle" do
    it "renders profile for existing user" do
      user = create(:user, twitter_handle: "testprofile", display_name: "Test Profile")
      create(:note, author: user)

      get "/u/testprofile"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Test Profile")
      expect(response.body).to include("@testprofile")
    end

    it "returns 404 for missing user" do
      get "/u/nonexistent"
      expect(response).to have_http_status(:not_found)
      expect(response.body).to include("not found")
    end

    it "hides notes with 3+ reports" do
      user = create(:user, twitter_handle: "reported_user")
      create(:note, author: user, body: "Visible note")
      create(:note, author: user, body: "Hidden note", reports_count: 3)

      get "/u/reported_user"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("Visible note")
      expect(response.body).not_to include("Hidden note")
    end

    it "shows stats" do
      user = create(:user, twitter_handle: "stats_user", reputation_score: 42.5, karma: 10.0, rating_impact: 5.5)

      get "/u/stats_user"
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("42.5")
      expect(response.body).to include("Rating Impact")
    end
  end

  describe "GET /u/:twitter_handle/notes" do
    it "returns notes page" do
      user = create(:user, twitter_handle: "paginated_user")
      create(:note, author: user)

      get "/u/paginated_user/notes", params: { page: 1 }
      expect(response).to have_http_status(:ok)
    end
  end
end
