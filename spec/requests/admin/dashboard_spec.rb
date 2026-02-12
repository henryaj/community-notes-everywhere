require "rails_helper"

RSpec.describe "Admin::Dashboard", type: :request do
  let(:superadmin) { create(:user, :superadmin, reputation_score: 50.0) }
  let(:admin) { create(:user, :admin, reputation_score: 50.0) }
  let(:regular_user) { create(:user, reputation_score: 30.0) }

  describe "GET /admin" do
    it "allows admin access" do
      get "/admin", headers: { "Authorization" => "Bearer #{admin.auth_token}" }
      expect(response).to have_http_status(:ok)
    end

    it "allows superadmin access" do
      get "/admin", headers: { "Authorization" => "Bearer #{superadmin.auth_token}" }
      expect(response).to have_http_status(:ok)
    end

    it "redirects regular users" do
      get "/admin", headers: { "Authorization" => "Bearer #{regular_user.auth_token}" }
      expect(response).to have_http_status(:forbidden)
    end

    it "redirects unauthenticated users" do
      get "/admin"
      expect(response).to have_http_status(:redirect)
    end
  end
end
