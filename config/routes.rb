Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  root "pages#home"
  get "/privacy", to: "pages#privacy"
  get "/terms", to: "pages#terms"
  get "/account", to: "pages#account"
  get "/n/:short_id", to: "notes_redirect#show", as: :short_note
  get "/u/:twitter_handle", to: "profiles#show", as: :profile
  get "/u/:twitter_handle/notes", to: "profiles#notes", as: :profile_notes

  get "/auth/x/callback", to: "auth#callback"
  get "/auth/dev", to: "auth#dev"
  get "/auth/dev/pick", to: "auth#dev_pick"
  get "/auth/failure", to: "auth#failure"

  namespace :api do
    resources :notes, only: [ :index, :create, :update, :destroy ] do
      resource :ratings, only: [ :create ]
      resources :reports, only: [ :create ]
      member do
        get :versions
        get :status_history
      end
    end
    namespace :ai_notes do
      post :draft
    end
    get :me, to: "me#show"
    namespace :me do
      resources :notes, only: [ :index ]
      resources :ratings, only: [ :index ]
    end
  end

  namespace :admin do
    root "dashboard#index"
    resources :reports, only: [ :index, :update ]
    resources :notes, only: [ :index, :destroy ]
    resources :users, only: [ :index ] do
      member do
        patch :promote
        patch :demote
      end
    end
  end
end
