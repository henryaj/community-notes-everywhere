module Admin
  class BaseController < ActionController::Base
    before_action :authenticate!
    before_action :require_admin!

    private

    def current_user
      @current_user ||= User.find_by(auth_token: bearer_token) if bearer_token
    end

    def bearer_token
      request.headers["Authorization"]&.match(/^Bearer (.+)$/)&.captures&.first || params[:token] || session[:auth_token]
    end

    def authenticate!
      unless current_user
        redirect_to "/auth/dev"
        return
      end
      session[:auth_token] = bearer_token
    end

    def require_admin!
      render plain: "Forbidden", status: :forbidden unless current_user&.admin_or_above?
    end

    def require_superadmin!
      render plain: "Forbidden", status: :forbidden unless current_user&.superadmin?
    end
  end
end
