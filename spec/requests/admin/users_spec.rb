require "rails_helper"

RSpec.describe "Admin::Users", type: :request do
  let(:superadmin) { create(:user, :superadmin, reputation_score: 50.0) }
  let(:admin) { create(:user, :admin, reputation_score: 50.0) }
  let(:regular_user) { create(:user, reputation_score: 30.0) }
  let(:superadmin_headers) { { "Authorization" => "Bearer #{superadmin.auth_token}" } }
  let(:admin_headers) { { "Authorization" => "Bearer #{admin.auth_token}" } }
  let(:user_headers) { { "Authorization" => "Bearer #{regular_user.auth_token}" } }

  describe "GET /admin/users" do
    it "returns user list for superadmin" do
      regular_user # ensure created
      get "/admin/users", headers: superadmin_headers
      expect(response).to have_http_status(:ok)
      expect(response.body).to include(regular_user.twitter_handle)
    end

    it "returns 403 for regular users" do
      get "/admin/users", headers: user_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 403 for admins" do
      get "/admin/users", headers: admin_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /admin/users/:id/promote" do
    it "promotes a regular user to admin" do
      patch "/admin/users/#{regular_user.id}/promote", headers: superadmin_headers
      expect(response).to redirect_to(admin_users_path)
      expect(regular_user.reload.admin?).to be true
    end

    it "returns 403 for regular users" do
      other_user = create(:user)
      patch "/admin/users/#{other_user.id}/promote", headers: user_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 403 for admins" do
      other_user = create(:user)
      patch "/admin/users/#{other_user.id}/promote", headers: admin_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "does not promote a superadmin" do
      another_superadmin = create(:user, :superadmin)
      patch "/admin/users/#{another_superadmin.id}/promote", headers: superadmin_headers
      expect(response).to redirect_to(admin_users_path)
      expect(another_superadmin.reload.superadmin?).to be true
    end
  end

  describe "PATCH /admin/users/:id/demote" do
    it "demotes an admin to regular user" do
      patch "/admin/users/#{admin.id}/demote", headers: superadmin_headers
      expect(response).to redirect_to(admin_users_path)
      expect(admin.reload.user?).to be true
    end

    it "returns 403 for regular users" do
      patch "/admin/users/#{admin.id}/demote", headers: user_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 403 for admins" do
      patch "/admin/users/#{regular_user.id}/demote", headers: admin_headers
      expect(response).to have_http_status(:forbidden)
    end
  end
end
