module Admin
  class UsersController < BaseController
    layout "pages"

    before_action :require_superadmin!
    before_action :set_user, only: [:promote, :demote]

    def index
      @users = User.order(:twitter_handle)
    end

    def promote
      @user.admin! unless @user.superadmin?
      redirect_to admin_users_path
    end

    def demote
      @user.user!
      redirect_to admin_users_path
    end

    private

    def set_user
      @user = User.find(params[:id])
    end
  end
end
