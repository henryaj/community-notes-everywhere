Rails.application.routes.draw do
  # Health check
  get "up" => "rails/health#show", as: :rails_health_check

  # OAuth
  get "/auth/x/callback", to: "auth#callback"
  get "/auth/dev", to: "auth#dev"
  get "/auth/failure", to: "auth#failure"

  # API
  namespace :api do
    resources :notes, only: [:index, :create] do
      resource :ratings, only: [:create]
    end
    get :me, to: "me#show"
  end
end
